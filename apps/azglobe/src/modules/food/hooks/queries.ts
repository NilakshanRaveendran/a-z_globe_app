import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isFirebaseReady } from '@core/firebase';
import {
  getMenuItem,
  getMerchant,
  listMenuItems,
  listMerchants,
  listPopularDishes,
  listReviews,
  searchCatalogue,
  type MerchantFilters,
} from '../services/merchants';
import { listActiveOffers } from '../services/promotions';
import { submitReview, type SubmitReviewInput } from '../services/reviews';
import { activeOffersKey } from './useAppliedPromotion';

/**
 * In demo mode the catalogue is a device-local store the business screens
 * edit (see services/demoCatalogue.ts), and switching account does not reset
 * this cache — so catalogue reads are always refetched on mount there. Reads
 * are cheap local lookups. With Firebase the app-wide staleTime applies.
 */
const catalogueFreshness = () => (isFirebaseReady() ? {} : { staleTime: 0 });

/**
 * Query keys are namespaced by module so a future module can never collide, and
 * so the whole Food cache can be invalidated in one call after an order.
 */
export const foodKeys = {
  all: ['food'] as const,
  merchants: (f: MerchantFilters) => [...foodKeys.all, 'merchants', f] as const,
  merchant: (id: string) => [...foodKeys.all, 'merchant', id] as const,
  menu: (merchantId: string, category?: string) =>
    [...foodKeys.all, 'menu', merchantId, category ?? 'All'] as const,
  menuItem: (merchantId: string, itemId: string) =>
    [...foodKeys.all, 'menuItem', merchantId, itemId] as const,
  popular: () => [...foodKeys.all, 'popular'] as const,
  reviews: (merchantId: string) => [...foodKeys.all, 'reviews', merchantId] as const,
  search: (query: string) => [...foodKeys.all, 'search', query.trim().toLowerCase()] as const,
};

export function useMerchants(filters: MerchantFilters = {}) {
  return useQuery({
    queryKey: foodKeys.merchants(filters),
    queryFn: () => listMerchants(filters),
    ...catalogueFreshness(),
  });
}

export function useMerchant(id: string) {
  return useQuery({
    queryKey: foodKeys.merchant(id),
    queryFn: () => getMerchant(id),
    enabled: Boolean(id),
    ...catalogueFreshness(),
  });
}

export function useMenu(merchantId: string, category?: string) {
  return useQuery({
    queryKey: foodKeys.menu(merchantId, category),
    queryFn: () => listMenuItems(merchantId, category),
    enabled: Boolean(merchantId),
    ...catalogueFreshness(),
  });
}

export function useMenuItem(merchantId: string, itemId: string) {
  return useQuery({
    queryKey: foodKeys.menuItem(merchantId, itemId),
    queryFn: () => getMenuItem(merchantId, itemId),
    enabled: Boolean(merchantId && itemId),
    ...catalogueFreshness(),
  });
}

export function usePopularDishes() {
  return useQuery({ queryKey: foodKeys.popular(), queryFn: () => listPopularDishes(4), ...catalogueFreshness() });
}

export function useReviews(merchantId: string) {
  return useQuery({
    queryKey: foodKeys.reviews(merchantId),
    queryFn: () => listReviews(merchantId),
    enabled: Boolean(merchantId),
    ...catalogueFreshness(),
  });
}

/**
 * A restaurant's running offers, newest first — the same query (and cache
 * entry) the cart applies them from, so the restaurant page's offer banner
 * and the discount in the cart always agree (audit C17).
 */
export function useActiveOffers(merchantId: string) {
  return useQuery({
    queryKey: activeOffersKey(merchantId),
    queryFn: () => listActiveOffers(merchantId),
    enabled: Boolean(merchantId),
    staleTime: isFirebaseReady() ? 60_000 : 0,
  });
}

/** "Search restaurants or dishes" (audit C7) — idle until there is a query. */
export function useSearchCatalogue(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: foodKeys.search(q),
    queryFn: () => searchCatalogue(q),
    enabled: q.length > 0,
    ...catalogueFreshness(),
  });
}

/**
 * Post a review (see services/reviews.ts). On success the restaurant's
 * reviews and its rating (the restaurant and the listings) are refetched.
 */
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitReviewInput) => submitReview(input),
    onSuccess: (_review, input) => {
      void qc.invalidateQueries({ queryKey: foodKeys.reviews(input.merchantId) });
      void qc.invalidateQueries({ queryKey: foodKeys.merchant(input.merchantId) });
      void qc.invalidateQueries({ queryKey: [...foodKeys.all, 'merchants'] });
    },
  });
}
