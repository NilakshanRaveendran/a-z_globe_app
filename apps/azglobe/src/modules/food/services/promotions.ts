import { isFirebaseReady } from '@core/firebase';
import { readCollection, readDoc } from '@core/firebase/db';
import { formatMoney } from '@core/utils/currency';
import { formatDayMonth } from '@core/utils/datetime';
import { promotions as designPromotions } from '../data/fixtures';
import type { CartLine, Money, Promotion } from '../types';

/**
 * Promotions — `promotions/{id}`. Two kinds share the collection:
 *
 * - **Promo codes**, typed into the cart. The document id is the code.
 * - **Offers**, created by a restaurant on Offers & Discounts. No code; while
 *   active and unexpired the cart applies the best one automatically.
 *
 * The discount is never stored in the cart. It is recomputed from the
 * promotion and the current lines every time they change, because a stored
 * amount goes stale the moment a quantity changes — and
 * `firestore.rules#promoTermsHold` then refuses the order for claiming more
 * than the promotion allows.
 */

// ── Pure maths (shared by cart, checkout and the rules tests' expectations) ──

/** Why a promotion does not apply right now, or null when it does. */
export function ineligibleReason(
  p: Promotion,
  merchantId: string,
  subtotal: Money,
  now = Date.now()
): string | null {
  if (p.active === false) return 'That offer is not running right now.';
  if (p.validUntil <= now) return 'That promo code has expired.';
  if (p.merchantId && p.merchantId !== merchantId) return 'That code is not valid at this restaurant.';
  if (p.usageLimit != null && (p.usedCount ?? 0) >= p.usageLimit) return 'That offer has been fully claimed.';
  if (p.minOrder && subtotal < p.minOrder) return `Spend at least ${formatMoney(p.minOrder)} to use this.`;
  return null;
}

/**
 * Rupees off for these lines. Percent discounts round DOWN so the amount never
 * exceeds what the rules allow; an items-only offer counts only those dishes.
 */
export function discountFor(p: Promotion, lines: CartLine[], subtotal: Money): Money {
  const base =
    p.appliesTo === 'items'
      ? lines
          .filter((l) => p.itemIds?.includes(l.menuItemId))
          .reduce((sum, l) => sum + l.unitPrice * l.qty, 0)
      : subtotal;
  if (base <= 0) return 0;
  const raw = p.type === 'percent' ? Math.floor((base * p.value) / 100) : p.value;
  return Math.max(0, Math.min(raw, base));
}

/** "20% OFF" / "Rs. 20 OFF". */
export function discountLabel(p: Pick<Promotion, 'type' | 'value'>): string {
  return p.type === 'percent' ? `${p.value}% OFF` : `${formatMoney(p.value)} OFF`;
}

/** "on All items" / "on Selected items". */
export function scopeLabel(p: Pick<Promotion, 'appliesTo'>): string {
  return p.appliesTo === 'items' ? 'on Selected items' : 'on All items';
}

/**
 * The card headline — "20% OFF on All items · Min. Rs. 500 · Until 30 Sept".
 * `withDate` is off on the compact list card, which Figma draws without it.
 */
export function offerHeadline(
  p: Pick<Promotion, 'type' | 'value' | 'appliesTo' | 'minOrder' | 'validUntil'>,
  { withDate = true }: { withDate?: boolean } = {}
): string {
  const parts = [`${discountLabel(p)} ${scopeLabel(p)}`];
  if (p.minOrder) parts.push(`Min. ${formatMoney(p.minOrder)}`);
  if (withDate && p.validUntil) parts.push(`Until ${formatDayMonth(p.validUntil)}`);
  return parts.join(' · ');
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** A restaurant's running offers (active and unexpired). */
export async function listActiveOffers(merchantId: string): Promise<Promotion[]> {
  if (!isFirebaseReady() || !merchantId) return [];
  const { rows } = await readCollection<Promotion>('promotions', {
    where: [
      ['merchantId', '==', merchantId],
      ['active', '==', true],
    ],
    limit: 20,
  });
  const now = Date.now();
  return rows.filter((p) => !p.code && p.validUntil > now);
}

/** A typed promo code, looked up by id. Fixtures only in design mode. */
export async function findPromoCode(rawCode: string): Promise<Promotion | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  if (!isFirebaseReady()) return designPromotions.find((p) => p.code?.toUpperCase() === code) ?? null;
  const p = await readDoc<Promotion>('promotions', code).catch(() => null);
  return p ? { ...p, id: code } : null;
}

/** The offer that saves the most on these lines, or null. */
export function bestOffer(
  offers: Promotion[],
  merchantId: string,
  lines: CartLine[],
  subtotal: Money
): { promo: Promotion; discount: Money } | null {
  let best: { promo: Promotion; discount: Money } | null = null;
  for (const promo of offers) {
    if (ineligibleReason(promo, merchantId, subtotal)) continue;
    const discount = discountFor(promo, lines, subtotal);
    if (discount > 0 && (!best || discount > best.discount)) best = { promo, discount };
  }
  return best;
}
