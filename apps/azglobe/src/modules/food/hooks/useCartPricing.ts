import { useQueries } from '@tanstack/react-query';
import { isFirebaseReady } from '@core/firebase';
import { getMerchant } from '../services/merchants';
import { quoteDelivery, type DeliveryQuote } from '../services/deliveryPricing';
import { effectiveFulfilment } from '../components/FulfilmentToggle';
import { cartGroups, useCart, type CartGroup, type Fulfilment } from '../store/cart';
import { NO_PROMOTION, useCartPromotions, type AppliedPromotion } from './useAppliedPromotion';
import { foodKeys } from './queries';
import type { Address, Merchant, Money } from '../types';

/** One restaurant's share of the cart, priced — exactly what its order is placed with. */
export type PricedGroup = CartGroup & {
  merchant: Merchant | undefined;
  /** Delivery or takeaway as it applies (takeaway when delivery can't reach). */
  fulfilment: Fulfilment;
  quote: DeliveryQuote | null;
  deliveryFee: Money;
  promotion: AppliedPromotion;
  /** Subtotal − discount + delivery fee (priority, if any, is added at checkout). */
  total: Money;
  closed: boolean;
  /** The restaurant couldn't be loaded (removed, or offline) — its dishes can't be ordered. */
  missing: boolean;
  /** Delivery chosen, but the address can't be priced yet (no address or pin). */
  needsAddress: boolean;
};

export type CartPricing = {
  groups: PricedGroup[];
  subtotal: Money;
  discount: Money;
  deliveryFees: Money;
  total: Money;
  /** At least one restaurant is delivering — the address matters. */
  anyDelivery: boolean;
  /** Restaurants that stop checkout: closed right now, or no longer available. */
  closed: PricedGroup[];
  needsAddress: boolean;
  loading: boolean;
};

/**
 * The whole cart priced restaurant by restaurant — the one calculation Cart
 * and Checkout share, so both show the figures each order is placed with.
 * Restaurant documents come from the same query cache as the menu screens.
 */
export function useCartPricing(address: Pick<Address, 'geo'> | null | undefined): CartPricing {
  const lines = useCart((s) => s.lines);
  const chosen = useCart((s) => s.fulfilment);
  const promotions = useCartPromotions();
  const groups = cartGroups(lines);

  const merchants = useQueries({
    queries: groups.map((g) => ({
      queryKey: foodKeys.merchant(g.merchantId),
      queryFn: () => getMerchant(g.merchantId),
      ...(isFirebaseReady() ? {} : { staleTime: 0 }),
    })),
  });

  const priced = groups.map((g, i): PricedGroup => {
    const query = merchants[i];
    const merchant = query?.data ?? undefined;
    const promotion = promotions[g.merchantId] ?? NO_PROMOTION;
    const quote = merchant ? quoteDelivery(merchant, address, g.subtotal) : null;
    const fulfilment = effectiveFulfilment(chosen[g.merchantId] ?? 'delivery', merchant, quote);
    const delivering = fulfilment === 'delivery';
    const deliveryFee = delivering && quote?.ok ? quote.fee : 0;
    return {
      ...g,
      merchantName: merchant?.name ?? g.merchantName,
      merchant,
      fulfilment,
      quote,
      deliveryFee,
      promotion,
      total: Math.max(0, g.subtotal - promotion.discount) + deliveryFee,
      closed: merchant?.isOpen === false,
      missing: !merchant && !!query && !query.isLoading,
      needsAddress: delivering && !!quote && !quote.ok,
    };
  });

  const sum = (f: (g: PricedGroup) => number) => priced.reduce((n, g) => n + f(g), 0);
  return {
    groups: priced,
    subtotal: sum((g) => g.subtotal),
    discount: sum((g) => g.promotion.discount),
    deliveryFees: sum((g) => g.deliveryFee),
    total: sum((g) => g.total),
    anyDelivery: priced.some((g) => g.fulfilment === 'delivery'),
    closed: priced.filter((g) => g.closed || g.missing),
    needsAddress: priced.some((g) => g.needsAddress),
    loading: merchants.some((m) => m.isLoading),
  };
}
