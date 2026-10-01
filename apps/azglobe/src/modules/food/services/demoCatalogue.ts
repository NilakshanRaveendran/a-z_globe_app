import { createStorage } from '@core/storage';
import * as fixtures from '../data/fixtures';
import type { MenuItem, Merchant, Promotion, Review } from '../types';

/**
 * The demo marketplace — ONE catalogue that both sides of the app read and
 * write while no Firebase project is configured.
 *
 * The business account ("Yaal Angaadi", `demo-provider`) owns two of the
 * Figma restaurants, `mamas-kitchen` and `yaal-angaadi`, under their fixture
 * ids — so customer links, carts and orders that already point at them keep
 * working. Everything the business edits (open/closed, menu, availability,
 * offers, review replies) lands in these stores, and the customer services
 * (`merchants.ts`, `promotions.ts`, `reviews.ts`) read the same stores. The
 * other fixture restaurants stay read-only design content.
 *
 * A restaurant the person creates through Add Restaurant starts EMPTY: no
 * menu, reviews or offers are invented for it (audit S4).
 *
 * Firebase mode never touches any of this; every caller sits behind
 * `!isFirebaseReady()`.
 *
 * Storage ids are the ones the supplier services have always used, so data a
 * browser already holds (restaurants, menus, offers, review replies) carries
 * over untouched.
 */

/** The demo business account — see SessionProvider. */
export const DEMO_SUPPLIER_ID = 'demo-provider';
/** The demo customer account — see SessionProvider's DESIGN_USER. */
export const DEMO_CUSTOMER_ID = 'dev-vanan';

/** The fixture restaurants the demo business account owns. */
export const SEEDED_DEMO_RESTAURANT_IDS: readonly string[] = ['mamas-kitchen', 'yaal-angaadi'];

/** True for the two owned fixture restaurants, which come with seeded content. */
export function isSeededDemoRestaurant(merchantId: string): boolean {
  return SEEDED_DEMO_RESTAURANT_IDS.includes(merchantId);
}

/**
 * Bumped whenever the owned restaurants change shape, so a browser that
 * already has a demo store gets them added (never replacing what it holds).
 */
const SEED_VERSION = '1';

function parse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const DAY = 24 * 60 * 60 * 1000;

/** The last millisecond of the day `days` days from now, local time. */
function endOfDayIn(days: number, now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days + 1);
  return d.getTime() - 1;
}

// ── Restaurants ─────────────────────────────────────────────────────────────

const restaurantStore = createStorage({ id: 'azglobe-demo-restaurants' });

/**
 * What each owned restaurant's tile says — its running seeded offer, worded
 * the way the offer editor words it (`offerRibbon` in supplier/services/
 * offers.ts), so the tile and the offer the cart applies never disagree
 * (audit C17).
 */
const SEEDED_OFFER_LABEL: Record<string, string> = {
  'mamas-kitchen': '50% OFF on Selected items',
  'yaal-angaadi': 'Rs. 100 OFF on All items',
};

function seededRestaurants(): Merchant[] {
  return fixtures.merchants
    .filter((m) => isSeededDemoRestaurant(m.id))
    .map((m) => {
      const offerLabel = SEEDED_OFFER_LABEL[m.id];
      return { ...m, supplierId: DEMO_SUPPLIER_ID, isOpen: true, ...(offerLabel ? { offerLabel } : {}) };
    });
}

/**
 * Every restaurant in the demo store — owned fixture ones first, then those
 * created through Add Restaurant — archived ones included (callers filter).
 */
export function readDemoRestaurants(): Merchant[] {
  const saved = parse<Merchant[]>(restaurantStore.getString('restaurants'));
  const list = Array.isArray(saved) ? saved : [];
  if (restaurantStore.getString('seedVersion') === SEED_VERSION) return list;
  const missing = seededRestaurants().filter((s) => !list.some((r) => r.id === s.id));
  const next = [...missing, ...list];
  writeDemoRestaurants(next);
  restaurantStore.set('seedVersion', SEED_VERSION);
  return next;
}

export function writeDemoRestaurants(restaurants: Merchant[]): void {
  restaurantStore.set('restaurants', JSON.stringify(restaurants));
}

export function findDemoRestaurant(merchantId: string): Merchant | null {
  return readDemoRestaurants().find((r) => r.id === merchantId) ?? null;
}

/** Apply `edits` to one stored restaurant. Throws when it is not in the store. */
export function editDemoRestaurant(merchantId: string, edits: Partial<Merchant>): Merchant {
  const restaurants = readDemoRestaurants();
  const current = restaurants.find((r) => r.id === merchantId);
  if (!current) throw new Error('Restaurant not found.');
  const next = { ...current, ...edits };
  writeDemoRestaurants(restaurants.map((r) => (r.id === merchantId ? next : r)));
  return next;
}

// ── Menus ───────────────────────────────────────────────────────────────────

const menuStore = createStorage({ id: 'azglobe-demo-menu' });
const menuKey = (merchantId: string) => `menu:${merchantId}`;

/**
 * A restaurant's whole menu, unavailable dishes included. The owned fixture
 * restaurants start from their Figma dishes (same ids, so carts keep
 * working); every other restaurant starts with none.
 */
export function readDemoMenu(merchantId: string): MenuItem[] {
  if (!merchantId) return [];
  const saved = parse<MenuItem[]>(menuStore.getString(menuKey(merchantId)));
  if (Array.isArray(saved)) return saved;
  if (!isSeededDemoRestaurant(merchantId)) return [];
  const seeded = fixtures.menuItems.filter((i) => i.merchantId === merchantId).map((i) => ({ ...i }));
  writeDemoMenu(merchantId, seeded);
  return seeded;
}

export function writeDemoMenu(merchantId: string, items: MenuItem[]): void {
  menuStore.set(menuKey(merchantId), JSON.stringify(items));
}

// ── Reviews ─────────────────────────────────────────────────────────────────

const reviewStore = createStorage({ id: 'azglobe-demo-reviews' });
const reviewKey = (merchantId: string) => `reviews:${merchantId}`;

/** Local time, so "31 Aug 2026" reads the same in every timezone. */
const at = (month: number, day: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).getTime();

const KOTTU =
  'Best kottu in Trincomalee — the flavour was spot-on and portions were generous. Will definitely order again!';

/**
 * Mama's Kitchen gets the customer-side Figma reviews (17:4787) — the ones its
 * Reviews tab always showed — with one answered, so a reply is visible on both
 * sides. Yaal Angaadi gets the cards from the business Reviews frame
 * (385:5924).
 */
function seededReviews(merchantId: string, now: number): Review[] {
  if (merchantId === 'mamas-kitchen') {
    return fixtures.reviews
      .filter((r) => r.merchantId === merchantId)
      .map((r) =>
        r.id === 'r2'
          ? {
              ...r,
              reply: {
                text: "Thank you, Priya! Sorry we were a little late — we're glad the sambol made up for it. 🙏",
                createdAt: Math.min(now, r.createdAt + 3 * 60 * 60 * 1000),
              },
            }
          : { ...r }
      );
  }
  if (merchantId === 'yaal-angaadi') {
    const review = (
      n: number,
      fields: Pick<Review, 'userName' | 'rating' | 'text' | 'dishTag' | 'createdAt' | 'reply'>
    ): Review => ({
      id: `${merchantId}-review-${n}`,
      merchantId,
      userId: `demo-customer-${n}`,
      helpfulCount: 0,
      hiddenByMerchant: false,
      ...fields,
    });
    return [
      review(1, { userName: 'Ravi S.', rating: 5, dishTag: 'Chicken Kottu', text: KOTTU, createdAt: at(8, 31, 20, 15) }),
      review(2, {
        userName: 'Priya M.',
        rating: 5,
        dishTag: 'Mutton Biryani',
        text: 'The biryani was fragrant and perfectly spiced. Delivery was quick and the food arrived hot. Highly recommend.',
        createdAt: at(8, 30, 19, 40),
        reply: { text: "Thank you so much, Priya! We're glad you enjoyed it. 🙏", createdAt: at(8, 30, 21, 5) },
      }),
      review(3, { userName: 'Kavi', rating: 5, dishTag: 'Chicken Kottu', text: KOTTU, createdAt: at(8, 31, 13, 30) }),
      review(4, {
        userName: 'Nimal P.',
        rating: 4,
        dishTag: 'Samosa',
        text: 'Crispy and hot, with a lovely coconut chutney. Would love a little more chutney on the side next time.',
        createdAt: at(8, 28, 9, 10),
      }),
      review(5, {
        userName: 'Sarah K.',
        rating: 5,
        dishTag: 'Chicken Kottu',
        text: 'Generous portion and the packaging kept everything warm. Easily the best kottu we have ordered in town.',
        createdAt: at(8, 26, 8, 45),
        reply: { text: 'Thanks, Sarah! See you again soon.', createdAt: at(8, 26, 12, 0) },
      }),
    ];
  }
  return [];
}

/**
 * A restaurant's reviews as stored — seeded for the owned fixture
 * restaurants, otherwise only what customers wrote on this device.
 */
export function readDemoReviews(merchantId: string, now = Date.now()): Review[] {
  if (!merchantId) return [];
  const saved = parse<Review[]>(reviewStore.getString(reviewKey(merchantId)));
  if (Array.isArray(saved)) return saved;
  if (!isSeededDemoRestaurant(merchantId)) return [];
  const seeded = seededReviews(merchantId, now);
  writeDemoReviews(merchantId, seeded);
  return seeded;
}

export function writeDemoReviews(merchantId: string, reviews: Review[]): void {
  reviewStore.set(reviewKey(merchantId), JSON.stringify(reviews));
}

/**
 * Store a review a customer just wrote, and keep the restaurant's headline
 * numbers in step with it — the tiles, the restaurant page and the owner's
 * summary all read `rating` / `reviewCount` once a restaurant has more
 * reviews than one page.
 */
export function appendDemoReview(review: Review): void {
  writeDemoReviews(review.merchantId, [review, ...readDemoReviews(review.merchantId)]);
  const merchant = findDemoRestaurant(review.merchantId);
  if (!merchant) return;
  const count = Math.max(0, merchant.reviewCount ?? 0);
  const total = (merchant.rating ?? 0) * count + review.rating;
  editDemoRestaurant(review.merchantId, {
    reviewCount: count + 1,
    rating: Math.round((total / (count + 1)) * 10) / 10,
  });
}

// ── Offers ──────────────────────────────────────────────────────────────────

const offerStore = createStorage({ id: 'azglobe-demo-offers' });
const offerKey = (merchantId: string) => `offers:${merchantId}`;

function seededOffers(merchantId: string, now: number): Promotion[] {
  const validUntil = endOfDayIn(30, now);
  if (merchantId === 'mamas-kitchen') {
    return [
      {
        id: 'mamas-kitchen-offer-select',
        merchantId,
        type: 'percent',
        value: 50,
        appliesTo: 'items',
        itemIds: ['mk-samosa', 'mk-lime-juice', 'mk-wood-apple'],
        validUntil,
        active: true,
        usedCount: 34,
        look: { label: 'LIMITED TIME OFFER', background: 'sunset', illustration: 'southIndian' },
        createdAt: now,
      },
      {
        id: 'mamas-kitchen-offer-weekend',
        merchantId,
        type: 'percent',
        value: 10,
        appliesTo: 'all',
        itemIds: [],
        minOrder: 1500,
        validUntil,
        active: false,
        usedCount: 12,
        look: { label: 'WEEKEND SPECIAL', background: 'grape', illustration: 'northIndian' },
        createdAt: now - DAY,
      },
    ];
  }
  if (merchantId === 'yaal-angaadi') {
    return [
      {
        id: 'yaal-angaadi-offer-welcome',
        merchantId,
        type: 'fixed',
        value: 100,
        appliesTo: 'all',
        itemIds: [],
        minOrder: 800,
        usageLimit: 100,
        validUntil,
        active: true,
        usedCount: 8,
        look: { label: 'WELCOME OFFER', background: 'ocean', illustration: 'gift' },
        createdAt: now,
      },
    ];
  }
  return [];
}

/** A restaurant's offers as stored — seeded for the owned fixture restaurants only. */
export function readDemoOffers(merchantId: string, now = Date.now()): Promotion[] {
  if (!merchantId) return [];
  const saved = parse<Promotion[]>(offerStore.getString(offerKey(merchantId)));
  if (Array.isArray(saved)) return saved;
  if (!isSeededDemoRestaurant(merchantId)) return [];
  const seeded = seededOffers(merchantId, now);
  writeDemoOffers(merchantId, seeded);
  return seeded;
}

export function writeDemoOffers(merchantId: string, offers: Promotion[]): void {
  offerStore.set(offerKey(merchantId), JSON.stringify(offers));
}
