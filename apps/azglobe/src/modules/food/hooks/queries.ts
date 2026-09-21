import { useQuery } from '@tanstack/react-query';
import {
  getMenuItem,
  getMerchant,
  listMenuItems,
  listMerchants,
  listPopularDishes,
  listReviews,
  type MerchantFilters,
} from '../services/merchants';

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
};

export function useMerchants(filters: MerchantFilters = {}) {
  return useQuery({
    queryKey: foodKeys.merchants(filters),
    queryFn: () => listMerchants(filters),
  });
}

export function useMerchant(id: string) {
  return useQuery({
    queryKey: foodKeys.merchant(id),
    queryFn: () => getMerchant(id),
    enabled: Boolean(id),
  });
}

export function useMenu(merchantId: string, category?: string) {
  return useQuery({
    queryKey: foodKeys.menu(merchantId, category),
    queryFn: () => listMenuItems(merchantId, category),
    enabled: Boolean(merchantId),
  });
}

export function useMenuItem(merchantId: string, itemId: string) {
  return useQuery({
    queryKey: foodKeys.menuItem(merchantId, itemId),
    queryFn: () => getMenuItem(merchantId, itemId),
    enabled: Boolean(merchantId && itemId),
  });
}

export function usePopularDishes() {
  return useQuery({ queryKey: foodKeys.popular(), queryFn: () => listPopularDishes(4) });
}

export function useReviews(merchantId: string) {
  return useQuery({
    queryKey: foodKeys.reviews(merchantId),
    queryFn: () => listReviews(merchantId),
    enabled: Boolean(merchantId),
  });
}
