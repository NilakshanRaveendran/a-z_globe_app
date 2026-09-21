import { isFirebaseReady } from '@core/firebase';
import { readCollection, readCollectionGroup, readDoc } from '@core/firebase/db';
import * as fixtures from '../data/fixtures';
import type { MenuItem, Merchant, Review } from '../types';

/**
 * Repositories for the Food module.
 *
 * Each reads Firestore when a Firebase project is configured and falls back to
 * the Figma fixtures otherwise, so the UI is identical either way. Every list
 * query is bounded and ordered — see `readCollection`.
 */

const MERCHANTS = 'merchants';

export type MerchantFilters = {
  cuisine?: string;
  /** The "Pickup" chip on the Order Food landing page (31:11648). */
  takeawayOnly?: boolean;
  /** The "Offers" chip. */
  offersOnly?: boolean;
  /** The "Under Rs.500" chip — applied against menu items, not merchants. */
  maxItemPrice?: number;
  search?: string;
};

export async function listMerchants(
  filters: MerchantFilters = {},
  limit = 20
): Promise<Merchant[]> {
  if (isFirebaseReady()) {
    const where: NonNullable<Parameters<typeof readCollection>[1]>['where'] = [
      ['module', '==', 'food'],
    ];
    if (filters.cuisine && filters.cuisine !== 'All') {
      where.push(['cuisines', 'array-contains', filters.cuisine]);
    }
    if (filters.takeawayOnly) where.push(['features', 'array-contains', 'takeaway']);

    const { rows } = await readCollection<Merchant>(MERCHANTS, {
      where,
      orderBy: { field: 'rating', direction: 'desc' },
      limit,
    });
    // `offersOnly` and `search` cannot be combined with the above in a single
    // Firestore query, so they are applied to the bounded result set.
    return applyLocalFilters(rows, filters).slice(0, limit);
  }

  return applyLocalFilters(fixtures.merchants, filters).slice(0, limit);
}

export async function getMerchant(id: string): Promise<Merchant | null> {
  if (isFirebaseReady()) return readDoc<Merchant>(MERCHANTS, id);
  return fixtures.merchants.find((m) => m.id === id) ?? null;
}

export async function listMenuItems(merchantId: string, category?: string): Promise<MenuItem[]> {
  if (isFirebaseReady()) {
    const { rows } = await readCollection<MenuItem>(`${MERCHANTS}/${merchantId}/menuItems`, {
      where: category && category !== 'All' ? [['category', '==', category]] : undefined,
      limit: 100,
    });
    return rows;
  }
  return fixtures.menuItems.filter(
    (i) => i.merchantId === merchantId && (!category || category === 'All' || i.category === category)
  );
}

export async function getMenuItem(merchantId: string, itemId: string): Promise<MenuItem | null> {
  if (isFirebaseReady()) return readDoc<MenuItem>(`${MERCHANTS}/${merchantId}/menuItems`, itemId);
  return fixtures.menuItems.find((i) => i.id === itemId) ?? null;
}

/**
 * Powers "Popular Dishes" on Home — the best-rated dishes across every
 * restaurant.
 *
 * Reads the real menus with a collection-group query rather than a
 * denormalised `popularDishes` table. That table only made sense while a Cloud
 * Function could maintain it; on Spark there is none, so it could only ever
 * hold stale seeded data — and a "popular dish" that no restaurant actually
 * serves is worse than an empty section.
 *
 * Returns [] when no restaurant has a menu yet. It does NOT fall back to the
 * fixtures: with Firebase configured, what the app shows is what suppliers
 * entered, never demo content dressed up as real.
 */
export async function listPopularDishes(limit = 4): Promise<MenuItem[]> {
  if (isFirebaseReady()) {
    const { rows } = await readCollectionGroup<MenuItem>('menuItems', {
      where: [['available', '==', true]],
      orderBy: { field: 'rating', direction: 'desc' },
      limit,
    });
    return rows;
  }
  return [...fixtures.menuItems].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export async function listReviews(merchantId: string, limit = 20): Promise<Review[]> {
  if (isFirebaseReady()) {
    const { rows } = await readCollection<Review>(`${MERCHANTS}/${merchantId}/reviews`, {
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit,
    });
    return rows;
  }
  return fixtures.reviews.filter((r) => r.merchantId === merchantId);
}

function applyLocalFilters(rows: Merchant[], f: MerchantFilters): Merchant[] {
  let out = rows;
  if (f.cuisine && f.cuisine !== 'All') out = out.filter((m) => m.cuisines.includes(f.cuisine!));
  if (f.takeawayOnly) out = out.filter((m) => m.features.includes('takeaway'));
  if (f.offersOnly) out = out.filter((m) => Boolean(m.offerLabel));
  if (f.search) {
    const q = f.search.toLowerCase();
    out = out.filter(
      (m) => m.name.toLowerCase().includes(q) || m.cuisines.some((c) => c.toLowerCase().includes(q))
    );
  }
  return out;
}
