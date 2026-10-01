import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@core/utils/currency';
import { listPromoCodes } from '../services/promotions';
import type { Promotion } from '../types';

/**
 * A promo code this restaurant accepts, to suggest in the cart — Figma cart
 * 414:2985 ("Try "MAMA20" for 20% off…") and checkout 414:3339 ("Use promo
 * code MAMA20 in your cart…").
 *
 * Only a real, running code is ever suggested: nothing is shown for a
 * restaurant without one, so the hint never names a code that would be refused.
 */
export function usePromoCodeHint(merchantId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ['promoCodeHint', merchantId ?? ''],
    queryFn: async () => (await listPromoCodes(merchantId ?? ''))[0] ?? null,
    enabled: Boolean(merchantId),
    staleTime: 5 * 60_000,
  });
  return data ?? null;
}

/** "20% off" / "Rs. 100 off", plus the minimum spend when there is one. */
export function promoSaving(p: Pick<Promotion, 'type' | 'value' | 'minOrder'>): string {
  const off = p.type === 'percent' ? `${p.value}% off` : `${formatMoney(p.value)} off`;
  return p.minOrder ? `${off} on orders over ${formatMoney(p.minOrder)}` : off;
}
