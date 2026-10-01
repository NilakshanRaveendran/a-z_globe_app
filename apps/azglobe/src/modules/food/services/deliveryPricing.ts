import type { Address, DeliveryRules, GeoPoint, Merchant, Money } from '../types';

/**
 * Delivery pricing by distance — the one rule Cart, Checkout, the order and
 * `firestore.rules` share. Pure (no app imports) so tools/web tests run it.
 *
 * Distance is straight-line, on the equirectangular approximation: plenty
 * accurate inside a delivery radius, and simple enough for the security rules
 * to compute the same figure (they have no trig, so they use a cosine series).
 * Rules allow DISTANCE_SLACK_KM either way for the two calculations to differ.
 */

export const EARTH_RADIUS_KM = 6371;
export const DISTANCE_SLACK_KM = 0.05;

type Pin = Pick<GeoPoint, 'lat' | 'lng'>;
type PricedMerchant = Pick<Merchant, 'deliveryFee' | 'freeDeliveryOver' | 'geo' | 'deliveryRules'>;

export function distanceKm(from: Pin, to: Pin): number {
  const rad = Math.PI / 180;
  const midLat = ((from.lat + to.lat) / 2) * rad;
  const x = (to.lng - from.lng) * rad * Math.cos(midLat);
  const y = (to.lat - from.lat) * rad;
  return Math.sqrt(x * x + y * y) * EARTH_RADIUS_KM;
}

/** Whole km charged past the free zone — at least 1 once outside it. */
export function chargedKm(km: number, freeKm: number): number {
  return Math.max(1, Math.ceil(km - freeKm - 1e-6));
}

/** The fee at `km` under distance pricing (before any order-value waiver). */
export function feeAtDistance(rules: Pick<DeliveryRules, 'freeKm' | 'perKm'>, baseFee: Money, km: number): Money {
  if (km <= rules.freeKm) return 0;
  return baseFee + rules.perKm * chargedKm(km, rules.freeKm);
}

/**
 * True when the restaurant's terms depend on where the customer is. Without a
 * restaurant pin there's nothing to measure from, so the flat fee applies —
 * the rules do the same, and Restaurant Info won't save distance terms unpinned.
 */
export function usesDistance(merchant: Pick<Merchant, 'geo' | 'deliveryRules'>): boolean {
  const r = merchant.deliveryRules;
  return !!r && !!merchant.geo && (r.pricing === 'distance' || r.maxKm > 0);
}

export type DeliveryQuote =
  | {
      ok: true;
      fee: Money;
      distanceKm?: number;
      /** Why it costs nothing: inside the free zone, or a big enough order. */
      free?: 'zone' | 'order' | 'flat';
    }
  | {
      ok: false;
      reason: 'needsAddress' | 'needsPin' | 'outOfRange';
      distanceKm?: number;
      maxKm?: number;
    };

/** What delivering `subtotal` to `address` costs, or why it can't be delivered. */
export function quoteDelivery(
  merchant: PricedMerchant,
  address: Pick<Address, 'geo'> | null | undefined,
  subtotal: Money
): DeliveryQuote {
  const rules = merchant.deliveryRules;
  let km: number | undefined;
  if (usesDistance(merchant) && rules) {
    if (!address) return { ok: false, reason: 'needsAddress' };
    if (!address.geo) return { ok: false, reason: 'needsPin' };
    km = distanceKm(merchant.geo!, address.geo);
    if (rules.maxKm > 0 && km > rules.maxKm) return { ok: false, reason: 'outOfRange', distanceKm: km, maxKm: rules.maxKm };
  }
  const threshold = merchant.freeDeliveryOver;
  if (threshold != null && threshold > 0 && subtotal >= threshold) {
    return { ok: true, fee: 0, distanceKm: km, free: 'order' };
  }
  if (rules?.pricing === 'distance' && km !== undefined) {
    const fee = feeAtDistance(rules, merchant.deliveryFee, km);
    return { ok: true, fee, distanceKm: km, ...(fee === 0 ? { free: 'zone' as const } : {}) };
  }
  return { ok: true, fee: merchant.deliveryFee, distanceKm: km, ...(merchant.deliveryFee === 0 ? { free: 'flat' as const } : {}) };
}

/**
 * The price list a restaurant's terms produce, one row per km band — the
 * preview on Restaurant Info and the table on the restaurant's Info tab.
 * Stops at the radius (or `upTo` km when there is none).
 */
export function feeSchedule(
  rules: Pick<DeliveryRules, 'pricing' | 'freeKm' | 'perKm' | 'maxKm'>,
  baseFee: Money,
  upTo = 5
): Array<{ fromKm: number; toKm: number; fee: Money }> {
  const end = rules.maxKm > 0 ? rules.maxKm : upTo;
  if (rules.pricing === 'flat') return [{ fromKm: 0, toKm: end, fee: baseFee }];
  const rows: Array<{ fromKm: number; toKm: number; fee: Money }> = [];
  const free = Math.min(rules.freeKm, end);
  if (free > 0) rows.push({ fromKm: 0, toKm: free, fee: 0 });
  for (let from = free; from < end - 1e-9 && rows.length < 30; from += 1) {
    const to = Math.min(from + 1, end);
    rows.push({ fromKm: from, toKm: to, fee: feeAtDistance(rules, baseFee, to) });
  }
  return rows;
}

/** 1 → "1", 1.5 → "1.5", 2.25 → "2.3" — km as people say them. */
export function formatKm(km: number): string {
  return String(Math.round(km * 10) / 10);
}
