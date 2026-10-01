import { formatMoney } from '@core/utils/currency';
import { formatKm, usesDistance } from '../services/deliveryPricing';
import type { Merchant } from '../types';

type Priced = Pick<Merchant, 'deliveryFee' | 'geo' | 'deliveryRules'>;

/**
 * The short price on restaurant cards and the restaurant header:
 * "Rs. 80 delivery", "Free delivery", "Free within 1 km", "Rs. 50/km delivery".
 */
export function deliveryPriceLabel(merchant: Priced, noun = 'delivery'): string {
  const r = merchant.deliveryRules;
  if (r?.pricing === 'distance' && usesDistance(merchant)) {
    if (r.freeKm > 0) return `Free within ${formatKm(r.freeKm)} km`;
    if (merchant.deliveryFee > 0) return `From ${formatMoney(merchant.deliveryFee + r.perKm)}`;
    return `${formatMoney(r.perKm)}/km ${noun}`;
  }
  return merchant.deliveryFee === 0 ? 'Free delivery' : `${formatMoney(merchant.deliveryFee)} ${noun}`;
}

/**
 * The restaurant's whole delivery terms in one line, or null when it has none
 * beyond a flat fee: "Free within 1 km · then Rs. 50/km · up to 5 km".
 */
export function deliveryTermsLine(merchant: Priced & Pick<Merchant, 'freeDeliveryOver'>): string | null {
  const r = merchant.deliveryRules;
  if (!r || !usesDistance(merchant)) return null;
  const parts: string[] = [];
  if (r.pricing === 'distance') {
    const per = `${formatMoney(r.perKm)}/km`;
    const charge = merchant.deliveryFee > 0 ? `${formatMoney(merchant.deliveryFee)} + ${per}` : per;
    if (r.freeKm > 0) parts.push(`Free within ${formatKm(r.freeKm)} km`, `then ${charge}`);
    else parts.push(charge);
  } else {
    parts.push(merchant.deliveryFee === 0 ? 'Free delivery' : `${formatMoney(merchant.deliveryFee)} delivery`);
  }
  if (r.maxKm > 0) parts.push(`up to ${formatKm(r.maxKm)} km`);
  return parts.join(' · ');
}
