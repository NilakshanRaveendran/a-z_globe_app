import { isFirebaseReady } from '@core/firebase';
import { readCollection, readDoc } from '@core/firebase/db';
import { formatMoney } from '@core/utils/currency';
import { formatDayMonth } from '@core/utils/datetime';
import { promotions as designPromotions } from '../data/fixtures';
import type { CartLine, Money, Promotion } from '../types';
import { readDemoOffers } from './demoCatalogue';

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

/** Whether a promotion covers this dish — every dish, or one it lists. */
export function coversItem(p: Pick<Promotion, 'appliesTo' | 'itemIds'>, menuItemId: string): boolean {
  return p.appliesTo !== 'items' || !!p.itemIds?.includes(menuItemId);
}

/**
 * Rupees a percent promotion takes off one cart line, rounded down. Fixed
 * promotions come off the order, not a dish, so a line alone shows nothing.
 */
export function lineDiscount(
  p: Pick<Promotion, 'type' | 'value' | 'appliesTo' | 'itemIds'>,
  line: Pick<CartLine, 'menuItemId' | 'unitPrice' | 'qty'>
): Money {
  if (p.type !== 'percent' || !coversItem(p, line.menuItemId)) return 0;
  return Math.floor((line.unitPrice * line.qty * p.value) / 100);
}

/**
 * Rupees off for these lines. A percent discount is the sum of each covered
 * line's own (rounded-down) saving, so the saving shown beside every dish adds
 * up exactly to the order's — and never exceeds what the rules allow. An
 * items-only promotion counts only those dishes; a fixed one comes off the
 * covered total once.
 */
export function discountFor(p: Promotion, lines: CartLine[], subtotal: Money): Money {
  const covered = lines.filter((l) => coversItem(p, l.menuItemId));
  const base =
    p.appliesTo === 'items' ? covered.reduce((sum, l) => sum + l.unitPrice * l.qty, 0) : subtotal;
  if (base <= 0) return 0;
  const raw = p.type === 'percent' ? covered.reduce((sum, l) => sum + lineDiscount(p, l), 0) : p.value;
  return Math.max(0, Math.min(raw, base));
}

/** A dish's offer, for showing on its card and page. */
export type ItemOffer = {
  promo: Promotion;
  /** "50% OFF" */
  label: string;
  /** The price after the offer, or null when it only applies above a minimum order. */
  price: Money | null;
};

/**
 * The running offer that saves most on one dish — percent offers only, since a
 * fixed amount comes off the order, not a dish. With a minimum order the label
 * says so and the price stays as it is until the cart reaches it.
 */
export function itemOffer(offers: Promotion[], item: { id: string; price: Money }): ItemOffer | null {
  let best: ItemOffer | null = null;
  let bestSaving = -1;
  for (const promo of offers) {
    if (promo.type !== 'percent' || !isRunningOffer(promo) || !coversItem(promo, item.id)) continue;
    const saving = Math.floor((item.price * promo.value) / 100);
    if (saving <= bestSaving) continue;
    bestSaving = saving;
    best = {
      promo,
      label: promo.minOrder ? `${discountLabel(promo)} over ${formatMoney(promo.minOrder)}` : discountLabel(promo),
      price: promo.minOrder ? null : item.price - saving,
    };
  }
  return best;
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

/** Switched on, unexpired and not fully claimed — an offer the cart may apply. */
export function isRunningOffer(p: Promotion, now = Date.now()): boolean {
  return (
    p.active !== false &&
    p.validUntil > now &&
    !(p.usageLimit != null && (p.usedCount ?? 0) >= p.usageLimit)
  );
}

// ── Reads ─────────────────────────────────────────────────────────────────

/**
 * A restaurant's running offers — switched on, unexpired and not fully
 * claimed — newest first. In demo mode these are the offers the demo business
 * manages on Offers & Discounts (audit C17), so the cart applies them by
 * itself exactly as it would with Firebase.
 */
export async function listActiveOffers(merchantId: string): Promise<Promotion[]> {
  if (!merchantId) return [];
  const now = Date.now();
  const running = (p: Promotion) => !p.code && isRunningOffer(p, now);
  const newestFirst = (a: Promotion, b: Promotion) => (b.createdAt ?? 0) - (a.createdAt ?? 0);

  if (!isFirebaseReady()) {
    return readDemoOffers(merchantId).filter(running).sort(newestFirst);
  }
  const { rows } = await readCollection<Promotion>('promotions', {
    where: [
      ['merchantId', '==', merchantId],
      ['active', '==', true],
    ],
    limit: 20,
  });
  return rows.filter(running).sort(newestFirst);
}

/** A typed promo code, looked up by id. Fixtures only in design mode. */
export async function findPromoCode(rawCode: string): Promise<Promotion | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  if (!isFirebaseReady()) return designPromotions.find((p) => p.code?.toUpperCase() === code) ?? null;
  const p = await readDoc<Promotion>('promotions', code).catch(() => null);
  return p ? { ...p, id: code } : null;
}

/**
 * The running promo codes this restaurant accepts — what the cart and checkout
 * suggest (Figma 414:2985 "Try "MAMA20"…", 414:3339). Codes and offers share
 * `promotions`; only codes carry `code`.
 */
export async function listPromoCodes(merchantId: string): Promise<Promotion[]> {
  const now = Date.now();
  const running = (p: Promotion) => Boolean(p.code) && p.active !== false && p.validUntil > now;
  if (!isFirebaseReady()) return designPromotions.filter((p) => p.merchantId === merchantId && running(p));
  const { rows } = await readCollection<Promotion>('promotions', {
    where: [['merchantId', '==', merchantId]],
    limit: 20,
  });
  return rows.filter(running);
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
