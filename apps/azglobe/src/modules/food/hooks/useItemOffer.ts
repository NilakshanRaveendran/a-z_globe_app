import { itemOffer, type ItemOffer } from '../services/promotions';
import { useActiveOffers } from './queries';
import type { MenuItem } from '../types';

/**
 * The restaurant's running offer on this dish, if any — what its card, row and
 * page show. Reads the same cached offers the cart applies. An order carries
 * one promotion, the one saving most on the whole order, so with two offers
 * running the cart may apply the other; it says so beside the saving.
 */
export function useItemOffer(item: Pick<MenuItem, 'id' | 'price' | 'merchantId'> | null | undefined): ItemOffer | null {
  const { data } = useActiveOffers(item?.merchantId ?? '');
  return item && data ? itemOffer(data, item) : null;
}
