import { useQueries, useQuery } from '@tanstack/react-query';
import { isFirebaseReady } from '@core/firebase';
import { cartGroups, useCart, type CartGroup } from '../store/cart';
import {
  bestOffer,
  discountFor,
  findPromoCode,
  ineligibleReason,
  listActiveOffers,
} from '../services/promotions';
import type { Money, Promotion } from '../types';

export type AppliedPromotion = {
  /** The promotion the order will carry, or null. */
  promo: Promotion | null;
  /** Rupees off the current lines. */
  discount: Money;
  /** Shown in the summary — the code the customer typed, or the offer's label. */
  label: string;
  /** Set when the customer typed a code that does not apply to this cart. */
  codeError: string | null;
  /** True for an offer the restaurant is running, false for a typed code. */
  automatic: boolean;
};

export const activeOffersKey = (merchantId: string) => ['offers', 'active', merchantId] as const;

type TypedLookup = { isLoading: boolean; data: Promotion | null | undefined };

/**
 * The discount on one restaurant's share of the cart, recomputed from the
 * promotion on every change — never a stored amount (see services/promotions).
 *
 * An order carries at most one promotion, so each restaurant's order gets the
 * better of the code typed for it and that restaurant's best running offer. A
 * typed code that does not apply (expired, wrong restaurant, below its
 * minimum…) is reported in `codeError` but never blocks the offer (audit C18);
 * neither does a valid code that saves less than the offer.
 */
function appliedFor(
  group: CartGroup,
  offers: Promotion[],
  promoCode: string | null,
  typed: TypedLookup
): AppliedPromotion {
  const { merchantId, lines, subtotal } = group;
  const best = bestOffer(offers, merchantId, lines, subtotal);
  const offer = (codeError: string | null): AppliedPromotion =>
    best
      ? {
          promo: best.promo,
          discount: best.discount,
          label: best.promo.look?.label || 'Offer',
          codeError,
          automatic: true,
        }
      : { promo: null, discount: 0, label: promoCode ?? '', codeError, automatic: !promoCode };

  if (!promoCode) return offer(null);
  // Still looking the code up: show the offer (if any) rather than flash a zero.
  if (typed.isLoading) {
    return best ? offer(null) : { promo: null, discount: 0, label: promoCode, codeError: null, automatic: false };
  }
  const promo = typed.data ?? null;
  const reason = promo ? ineligibleReason(promo, merchantId, subtotal) : 'That promo code is not valid.';
  const discount = promo && !reason ? discountFor(promo, lines, subtotal) : 0;
  if (promo && !reason && discount > 0) {
    if (!best || discount >= best.discount) {
      return { promo, discount, label: promoCode, codeError: null, automatic: false };
    }
    return offer('The restaurant’s own offer saves you more, so it is applied instead.');
  }
  return offer(reason ?? 'That code does not apply to the dishes in your cart.');
}

/**
 * Every restaurant's promotion in the cart, keyed by merchant id. Cart and
 * Checkout both read this, so the figures shown are the ones each order is
 * placed with.
 */
export function useCartPromotions(): Record<string, AppliedPromotion> {
  const lines = useCart((s) => s.lines);
  const promoCode = useCart((s) => s.promoCode);
  const promoMerchantId = useCart((s) => s.promoMerchantId);
  const groups = cartGroups(lines);

  const offers = useQueries({
    queries: groups.map((g) => ({
      queryKey: activeOffersKey(g.merchantId),
      queryFn: () => listActiveOffers(g.merchantId),
      // Demo offers are a local store the business side edits — always re-read.
      staleTime: isFirebaseReady() ? 60_000 : 0,
    })),
  });

  const typed = useQuery({
    queryKey: ['promoCode', promoCode],
    queryFn: () => findPromoCode(promoCode ?? ''),
    enabled: !!promoCode,
    staleTime: 60_000,
  });

  const out: Record<string, AppliedPromotion> = {};
  groups.forEach((g, i) => {
    out[g.merchantId] = appliedFor(
      g,
      offers[i]?.data ?? [],
      g.merchantId === promoMerchantId ? promoCode : null,
      { isLoading: typed.isLoading, data: typed.data }
    );
  });
  return out;
}

export const NO_PROMOTION: AppliedPromotion = {
  promo: null,
  discount: 0,
  label: '',
  codeError: null,
  automatic: true,
};
