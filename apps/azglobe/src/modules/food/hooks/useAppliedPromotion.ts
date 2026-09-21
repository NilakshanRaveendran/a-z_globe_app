import { useQuery } from '@tanstack/react-query';
import { useCart } from '../store/cart';
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

/**
 * The discount on the current cart, recomputed from the promotion on every
 * change — never a stored amount (see services/promotions.ts).
 *
 * A code the customer typed wins; otherwise the restaurant's best running offer
 * applies by itself. Both Cart and Checkout read this, so the figure the
 * customer sees is the one the order is placed with.
 */
export function useAppliedPromotion(): AppliedPromotion {
  const merchantId = useCart((s) => s.merchantId) ?? '';
  const lines = useCart((s) => s.lines);
  const promoCode = useCart((s) => s.promoCode);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  const offers = useQuery({
    queryKey: activeOffersKey(merchantId),
    queryFn: () => listActiveOffers(merchantId),
    enabled: !!merchantId,
    staleTime: 60_000,
  });

  const typed = useQuery({
    queryKey: ['promoCode', promoCode],
    queryFn: () => findPromoCode(promoCode ?? ''),
    enabled: !!promoCode,
    staleTime: 60_000,
  });

  if (promoCode) {
    const promo = typed.data ?? null;
    if (typed.isLoading) return { promo: null, discount: 0, label: promoCode, codeError: null, automatic: false };
    const reason = promo ? ineligibleReason(promo, merchantId, subtotal) : 'That promo code is not valid.';
    if (!reason && promo) {
      const discount = discountFor(promo, lines, subtotal);
      if (discount > 0) return { promo, discount, label: promoCode, codeError: null, automatic: false };
    }
    return {
      promo: null,
      discount: 0,
      label: promoCode,
      codeError: reason ?? 'That code does not apply to the dishes in your cart.',
      automatic: false,
    };
  }

  const best = bestOffer(offers.data ?? [], merchantId, lines, subtotal);
  if (!best) return { promo: null, discount: 0, label: '', codeError: null, automatic: true };
  return {
    promo: best.promo,
    discount: best.discount,
    label: best.promo.look?.label || 'Offer',
    codeError: null,
    automatic: true,
  };
}
