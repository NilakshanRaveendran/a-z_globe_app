import { isFirebaseReady } from '@core/firebase';
import { readCollection, readCollectionGroup, readDoc } from '@core/firebase/db';
import * as fixtures from '../data/fixtures';
import type { MenuItem, Merchant, Review } from '../types';
import { readDemoMenu, readDemoRestaurants, readDemoReviews } from './demoCatalogue';

/**
 * Repositories for the Food module.
 *
 * Each reads Firestore when a Firebase project is configured. Without one the
 * app runs on the demo marketplace (`./demoCatalogue`): the restaurants the
 * demo business account operates — the two Figma restaurants it owns plus any
 * it created — come from the same store the business screens edit, so a menu
 * change, an offer or a review reply made there shows up here. The remaining
 * Figma restaurants are read-only fixtures. Every list query is bounded and
 * ordered — see `readCollection`.
 *
 * Customers never get an unavailable dish from a list (audit C14). A direct
 * lookup (`getMenuItem`) still returns it, so the item page can say "Sold out"
 * and a cart line can be told apart from a dish that no longer exists.
 */

const MERCHANTS = 'merchants';

export type MerchantFilters = {
  cuisine?: string;
  /** The "Pickup" chip on the Order Food landing page (31:11648). */
  takeawayOnly?: boolean;
  /** The "Offers" chip. */
  offersOnly?: boolean;
  /**
   * The "Under Rs.500" chip — keeps restaurants with at least one available
   * dish at or under this price.
   */
  maxItemPrice?: number;
  search?: string;
};

/** The most restaurants a filtered Firestore read scans before filtering on the device. */
const MAX_SCAN = 50;

export async function listMerchants(
  filters: MerchantFilters = {},
  limit = 20
): Promise<Merchant[]> {
  if (isFirebaseReady()) {
    const where: NonNullable<Parameters<typeof readCollection>[1]>['where'] = [
      ['module', '==', 'food'],
    ];
    const cuisine = cuisineFilter(filters.cuisine);
    // Firestore allows one array filter per query, and `array-contains` is
    // case-sensitive: match the common spellings on the server, and let
    // `applyLocalFilters` make the final, case-insensitive call.
    if (cuisine) where.push(['cuisines', 'array-contains-any', spellings(filters.cuisine ?? '')]);
    else if (filters.takeawayOnly) where.push(['features', 'array-contains', 'takeaway']);

    const { rows } = await readCollection<Merchant>(MERCHANTS, {
      where,
      orderBy: { field: 'rating', direction: 'desc' },
      // Room for the filters applied below, still bounded.
      limit: Math.min(MAX_SCAN, limit * 2),
    });
    const listed = applyLocalFilters(rows.filter((m) => !m.archived), filters);
    return (await withDishUnder(listed, filters.maxItemPrice)).slice(0, limit);
  }

  const listed = applyLocalFilters(demoMerchants().filter((m) => !m.archived), filters);
  return (await withDishUnder(listed, filters.maxItemPrice)).slice(0, limit);
}

/**
 * One restaurant. An archived one is still returned — closed — so a cart or an
 * order that points at it keeps rendering; it is only dropped from listings.
 */
export async function getMerchant(id: string): Promise<Merchant | null> {
  if (!id) return null;
  const merchant = isFirebaseReady()
    ? await readDoc<Merchant>(MERCHANTS, id)
    : demoMerchants().find((m) => m.id === id) ?? null;
  return merchant?.archived ? { ...merchant, isOpen: false } : merchant;
}

export async function listMenuItems(merchantId: string, category?: string): Promise<MenuItem[]> {
  if (!merchantId) return [];
  const byCategory = category && category !== 'All' ? category : undefined;
  if (isFirebaseReady()) {
    const { rows } = await readCollection<MenuItem>(`${MERCHANTS}/${merchantId}/menuItems`, {
      where: byCategory ? [['category', '==', byCategory]] : undefined,
      limit: 100,
    });
    return rows.filter(isAvailable);
  }
  return demoMenuFor(merchantId).filter(
    (i) => isAvailable(i) && (!byCategory || i.category === byCategory)
  );
}

export async function getMenuItem(merchantId: string, itemId: string): Promise<MenuItem | null> {
  if (isFirebaseReady()) return readDoc<MenuItem>(`${MERCHANTS}/${merchantId}/menuItems`, itemId);
  const menu = merchantId ? demoMenuFor(merchantId) : fixtures.menuItems;
  return menu.find((i) => i.id === itemId) ?? null;
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
  const dishes = demoDishes();
  const featured = ['mk-chicken-kottu', 'mk-dosa', 'ya-samosa', 'tsh-rotty-set'];
  const ordered = featured.flatMap((id) => dishes.filter((item) => item.id === id));
  return [...ordered, ...dishes.filter((item) => !featured.includes(item.id))].slice(0, limit);
}

/**
 * A restaurant's reviews, newest first. Hidden-by-owner reviews are included:
 * hiding only files them away on the owner's screen.
 */
export async function listReviews(merchantId: string, limit = 20): Promise<Review[]> {
  if (!merchantId) return [];
  if (isFirebaseReady()) {
    const { rows } = await readCollection<Review>(`${MERCHANTS}/${merchantId}/reviews`, {
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit,
    });
    // Seeded reviews store Timestamps; the app writes epoch millis.
    return rows.map((r) => ({
      ...r,
      createdAt: toMillis(r.createdAt),
      reply: r.reply?.text?.trim() ? { text: r.reply.text, createdAt: toMillis(r.reply.createdAt) } : undefined,
    }));
  }
  const stored = readDemoReviews(merchantId);
  // A restaurant in the demo store keeps ALL its reviews there (seeded ones
  // included). A read-only fixture restaurant adds what was written locally.
  const reviews = isStoreRestaurant(merchantId)
    ? stored
    : [
        ...stored,
        ...fixtures.reviews.filter((r) => r.merchantId === merchantId && !stored.some((s) => s.id === r.id)),
      ];
  return [...reviews].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/** How many of each a search returns. */
const SEARCH_MERCHANTS = 20;
const SEARCH_DISHES = 30;

/**
 * "Search restaurants or dishes" (audit C7): a case-insensitive match over
 * restaurant name, cuisines and tagline, and dish name, category and
 * description. Available dishes of listed restaurants only; bounded.
 *
 * Firestore has no substring search, so with Firebase this scans the top
 * restaurants and dishes by rating (one bounded read each) and filters here.
 */
export async function searchCatalogue(
  query: string
): Promise<{ merchants: Merchant[]; dishes: MenuItem[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return { merchants: [], dishes: [] };
  const has = (value: string | undefined) => Boolean(value && value.toLowerCase().includes(q));
  const merchantMatches = (m: Merchant) => has(m.name) || has(m.tagline) || m.cuisines.some(has);
  const dishMatches = (d: MenuItem) => has(d.name) || has(d.category) || has(d.description);

  if (isFirebaseReady()) {
    const [merchantRows, dishRows] = await Promise.all([
      readCollection<Merchant>(MERCHANTS, {
        where: [['module', '==', 'food']],
        orderBy: { field: 'rating', direction: 'desc' },
        limit: 100,
      }),
      readCollectionGroup<MenuItem>('menuItems', {
        where: [['available', '==', true]],
        orderBy: { field: 'rating', direction: 'desc' },
        limit: 200,
      }),
    ]);
    const archived = new Set(merchantRows.rows.filter((m) => m.archived).map((m) => m.id));
    return {
      merchants: merchantRows.rows.filter((m) => !m.archived && merchantMatches(m)).slice(0, SEARCH_MERCHANTS),
      dishes: dishRows.rows
        .filter((d) => isAvailable(d) && !archived.has(d.merchantId) && dishMatches(d))
        .slice(0, SEARCH_DISHES),
    };
  }

  return {
    merchants: demoMerchants()
      .filter((m) => !m.archived && merchantMatches(m))
      .slice(0, SEARCH_MERCHANTS),
    dishes: demoDishes().filter(dishMatches).slice(0, SEARCH_DISHES),
  };
}

// ── Demo marketplace ─────────────────────────────────────────────────────────

/**
 * Every restaurant a customer can reach in demo mode: the Figma restaurants in
 * their design order (the demo store's copy wherever the business owns one),
 * then the restaurants the business created. Archived ones included.
 */
function demoMerchants(): Merchant[] {
  const store = readDemoRestaurants();
  const fixtureIds = new Set(fixtures.merchants.map((m) => m.id));
  return [
    ...fixtures.merchants.map((m) => store.find((s) => s.id === m.id) ?? m),
    ...store.filter((m) => !fixtureIds.has(m.id)),
  ];
}

function isStoreRestaurant(merchantId: string): boolean {
  return readDemoRestaurants().some((m) => m.id === merchantId);
}

/** A restaurant's whole menu, unavailable dishes included. */
function demoMenuFor(merchantId: string): MenuItem[] {
  return isStoreRestaurant(merchantId)
    ? readDemoMenu(merchantId)
    : fixtures.menuItems.filter((i) => i.merchantId === merchantId);
}

/** Every available dish of every listed restaurant, in restaurant order. */
function demoDishes(): MenuItem[] {
  return demoMerchants()
    .filter((m) => !m.archived)
    .flatMap((m) => demoMenuFor(m.id))
    .filter(isAvailable);
}

// ── Filters ──────────────────────────────────────────────────────────────────

const isAvailable = (item: MenuItem) => item.available !== false;

const norm = (value: string) => value.trim().toLowerCase();

/** The cuisine to filter by, normalised, or null for none / "All". */
function cuisineFilter(cuisine: string | undefined): string | null {
  const c = norm(cuisine ?? '');
  return c && c !== 'all' ? c : null;
}

/** "rice & curry" → the spellings a supplier is likely to have stored. */
function spellings(raw: string): string[] {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const title = lower
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return [...new Set([trimmed, lower, title, trimmed.toUpperCase()])];
}

function applyLocalFilters(rows: Merchant[], f: MerchantFilters): Merchant[] {
  let out = rows;
  const cuisine = cuisineFilter(f.cuisine);
  if (cuisine) out = out.filter((m) => m.cuisines.some((c) => norm(c) === cuisine));
  if (f.takeawayOnly) out = out.filter((m) => m.features.includes('takeaway'));
  if (f.offersOnly) out = out.filter((m) => Boolean(m.offerLabel));
  if (f.search) {
    const q = norm(f.search);
    out = out.filter(
      (m) => m.name.toLowerCase().includes(q) || m.cuisines.some((c) => c.toLowerCase().includes(q))
    );
  }
  return out;
}

/** Keep restaurants with at least one available dish at or under `maxPrice` (audit C12). */
async function withDishUnder(rows: Merchant[], maxPrice: number | undefined): Promise<Merchant[]> {
  if (maxPrice == null || !Number.isFinite(maxPrice)) return rows;
  if (!isFirebaseReady()) {
    return rows.filter((m) => demoMenuFor(m.id).some((i) => isAvailable(i) && i.price <= maxPrice));
  }
  // One small read per restaurant (the list is already bounded). A range on
  // `price` alone needs no composite index; availability is checked here.
  const keep = await Promise.all(
    rows.map(async (m) => {
      const { rows: cheap } = await readCollection<MenuItem>(`${MERCHANTS}/${m.id}/menuItems`, {
        where: [['price', '<=', maxPrice]],
        limit: 20,
      }).catch(() => ({ rows: [] as MenuItem[] }));
      return cheap.some(isAvailable);
    })
  );
  return rows.filter((_, i) => keep[i]);
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  const maybe = value as { toMillis?: () => number } | null | undefined;
  return typeof maybe?.toMillis === 'function' ? maybe.toMillis() : 0;
}
