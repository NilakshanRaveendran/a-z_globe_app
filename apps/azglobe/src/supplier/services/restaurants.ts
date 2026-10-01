import {
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection, readDoc } from '@core/firebase/db';
import type { DayHours, DeliveryRules, MenuItem, Merchant, MerchantFeature } from '@modules/food/types';
import {
  editDemoRestaurant,
  findDemoRestaurant,
  readDemoMenu,
  readDemoRestaurants,
  writeDemoMenu,
  writeDemoRestaurants,
} from '@modules/food/services/demoCatalogue';
import { restaurantStepErrors } from './restaurantValidation';

/**
 * The owned fixture restaurants (`mamas-kitchen`, `yaal-angaadi`) come with a
 * seeded menu, reviews, offers and orders in demo mode; restaurants created
 * through Add Restaurant start empty. See `@modules/food/services/demoCatalogue`.
 */
export { isSeededDemoRestaurant } from '@modules/food/services/demoCatalogue';

/**
 * Supplier-side writes for the restaurants an account operates.
 *
 * Everything a restaurant is — its name, menu, hours, fees — is created HERE,
 * by the supplier, through the app. There is no seeding step: the catalogue a
 * customer browses is exactly what suppliers entered.
 *
 * On the Spark plan there is no Cloud Function in front of these writes, so
 * `firestore.rules` is the enforcement. It requires the caller to hold a
 * `suppliers/{uid}` profile and the document to name that uid — see
 * `ownsMerchant()` there.
 */

const MERCHANTS = 'merchants';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export type NewRestaurant = {
  name: string;
  cuisines: string[];
  tagline: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
  closedDays: Day[];
  prepTimeMin: number;
  prepTimeMax: number;
  deliveryAvailable: boolean;
  deliveryFee: number;
};

/** A slug that reads well in a URL and stays stable — the merchant's doc id. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'restaurant'
  );
}

export function draftRestaurantId(name: string): string {
  // A short random suffix keeps two restaurants of the same name apart without
  // needing a uniqueness query the rules would have to allow.
  return `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
}

function hoursFor(input: NewRestaurant): Record<Day, DayHours> {
  const entries = DAYS.map((day) => [
    day,
    input.closedDays.includes(day)
      ? { open: input.openTime, close: input.closeTime, closed: true }
      : { open: input.openTime, close: input.closeTime },
  ]);
  return Object.fromEntries(entries) as Record<Day, DayHours>;
}

/**
 * Create a restaurant owned by this supplier account.
 *
 * `rating` and `reviewCount` are written as 0 deliberately. The rules refuse
 * any non-zero value — a supplier cannot award itself stars — but they must be
 * PRESENT, because the customer catalogue query orders by `rating` and
 * Firestore omits documents that lack the ordered field. A restaurant created
 * without them would be invisible to every customer.
 */
export async function createRestaurant(
  supplierUid: string,
  input: NewRestaurant
): Promise<string> {
  if (!supplierUid) throw new Error('A business account is required.');
  const validationError = restaurantStepErrors(input).find(Boolean);
  if (validationError) throw new Error(validationError);

  const id = draftRestaurantId(input.name);
  const features: MerchantFeature[] = ['takeaway', ...(input.deliveryAvailable ? ['homeDelivery' as const] : [])];

  const merchant: Omit<Merchant, 'id'> & { createdAt: unknown } = {
    module: 'food',
    supplierId: supplierUid,
    name: input.name.trim(),
    tagline: input.tagline.trim(),
    cuisines: input.cuisines,
    rating: 0,
    reviewCount: 0,
    deliveryFee: input.deliveryAvailable ? input.deliveryFee : 0,
    prepTimeMin: input.prepTimeMin,
    prepTimeMax: input.prepTimeMax,
    // No `geo`: the map pin is set later from Restaurant Info. See Merchant.geo.
    address: input.address.trim(),
    phone: input.phone.trim(),
    hours: hoursFor(input),
    // A new restaurant opens closed. Taking orders is a deliberate act, and the
    // rules refuse orders placed with a closed restaurant — so this is also
    // what stops customers ordering from a half-configured menu.
    isOpen: false,
    features,
    coverImage: '',
    badges: [],
    createdAt: isFirebaseReady() ? serverTimestamp() : Date.now(),
  };

  if (!isFirebaseReady()) {
    writeDemoRestaurants([...readDemoRestaurants(), { ...merchant, id }]);
    return id;
  }
  await setDoc(doc(collection(getFirestore(getApp()), MERCHANTS), id), merchant);
  return id;
}

/**
 * The restaurants this supplier account operates. Archived ones are left out
 * (audit S8) — `getOwnedRestaurant` still finds them by id.
 */
export async function listOwnedRestaurants(supplierUid: string): Promise<Merchant[]> {
  if (!supplierUid) return [];
  if (!isFirebaseReady()) {
    return readDemoRestaurants().filter((r) => r.supplierId === supplierUid && !r.archived);
  }
  const { rows } = await readCollection<Merchant>(MERCHANTS, {
    where: [['supplierId', '==', supplierUid]],
    limit: 50,
  });
  // Filtered here rather than in the query: `archived` is absent on every
  // restaurant that was never archived, and `!= true` would drop those.
  return rows.filter((r) => !r.archived);
}

/** One restaurant, for the info/edit screen. */
export async function getOwnedRestaurant(merchantId: string): Promise<Merchant | null> {
  if (!merchantId) return null;
  if (!isFirebaseReady()) return findDemoRestaurant(merchantId);
  return readDoc<Merchant>(MERCHANTS, merchantId);
}

export type RestaurantEdits = Partial<{
  name: string;
  tagline: string;
  cuisines: string[];
  address: string;
  phone: string;
  deliveryFee: number;
  /** Null clears it back to a flat fee with no area limit. */
  deliveryRules: DeliveryRules | null;
  freeDeliveryOver: number | null;
  prepTimeMin: number;
  prepTimeMax: number;
  features: MerchantFeature[];
  hours: Record<Day, DayHours>;
  geo: { lat: number; lng: number; geohash: string };
}>;

/**
 * Edit a restaurant this account owns.
 *
 * `supplierId`, `rating` and `reviewCount` are deliberately absent from
 * `RestaurantEdits`: the rules refuse an update that touches any of them, so
 * excluding them from the type stops a caller writing something the database
 * will reject. Ownership is not transferable by a write, and stars are earned.
 *
 * A rename also rewrites the `merchantName` copied onto each dish (audit
 * S36) — customer dish cards show that copy. Orders keep the name they were
 * placed under, which is what a receipt should do.
 */
export async function updateRestaurant(
  merchantId: string,
  edits: RestaurantEdits
): Promise<void> {
  const name = edits.name?.trim();
  if (!isFirebaseReady()) {
    const before = findDemoRestaurant(merchantId);
    editDemoRestaurant(merchantId, edits);
    if (name && before && before.name !== name) {
      const menu = readDemoMenu(merchantId);
      if (menu.length) writeDemoMenu(merchantId, menu.map((item) => ({ ...item, merchantName: name })));
    }
    return;
  }
  const db = getFirestore(getApp());
  await updateDoc(doc(collection(db, MERCHANTS), merchantId), edits);
  if (name) await renameMenuItems(merchantId, name);
}

/** The most dishes one rename rewrites — the same bound the menu screen reads. */
const RENAME_BATCH_LIMIT = 100;

/**
 * Point every dish's `merchantName` at the new name, in one batch. Only dishes
 * that still carry another name are written. A failure here leaves the rename
 * itself in place — stale dish cards are better than a refused rename.
 */
async function renameMenuItems(merchantId: string, name: string): Promise<void> {
  const db = getFirestore(getApp());
  const path = `${MERCHANTS}/${merchantId}/menuItems`;
  const { rows } = await readCollection<MenuItem>(path, { limit: RENAME_BATCH_LIMIT });
  const stale = rows.filter((item) => item.merchantName !== name);
  if (!stale.length) return;
  const batch = writeBatch(db);
  for (const item of stale) batch.update(doc(collection(db, path), item.id), { merchantName: name });
  await batch.commit().catch(() => {});
}

/** Open or close a restaurant for orders. */
export async function setRestaurantOpen(merchantId: string, isOpen: boolean): Promise<void> {
  if (!isFirebaseReady()) {
    editDemoRestaurant(merchantId, { isOpen });
    return;
  }
  await updateDoc(doc(collection(getFirestore(getApp()), MERCHANTS), merchantId), { isOpen });
}

/**
 * Retire a restaurant (audit S8). It closes and disappears from the owner's
 * list and from the customer catalogue; its orders and reviews stay intact.
 *
 * Firestore refuses deletes on `merchants/*` (orders and reviews point at
 * them), so both modes mark it `archived` instead. The caller should refuse
 * while the restaurant still has active orders.
 */
export async function archiveRestaurant(merchantId: string): Promise<void> {
  if (!merchantId) throw new Error('Choose a restaurant to archive.');
  if (!isFirebaseReady()) {
    editDemoRestaurant(merchantId, { archived: true, isOpen: false });
    return;
  }
  await updateDoc(doc(collection(getFirestore(getApp()), MERCHANTS), merchantId), {
    archived: true,
    isOpen: false,
  });
}
