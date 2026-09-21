import {
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection, readDoc } from '@core/firebase/db';
import type { DayHours, Merchant, MerchantFeature } from '@modules/food/types';

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
  if (!isFirebaseReady()) throw new Error('Firebase is not configured.');

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
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(collection(getFirestore(getApp()), MERCHANTS), id), merchant);
  return id;
}

/** The restaurants this supplier account operates. */
export async function listOwnedRestaurants(supplierUid: string): Promise<Merchant[]> {
  if (!isFirebaseReady() || !supplierUid) return [];
  const { rows } = await readCollection<Merchant>(MERCHANTS, {
    where: [['supplierId', '==', supplierUid]],
    limit: 50,
  });
  return rows;
}

/** One restaurant, for the info/edit screen. */
export async function getOwnedRestaurant(merchantId: string): Promise<Merchant | null> {
  if (!isFirebaseReady() || !merchantId) return null;
  return readDoc<Merchant>(MERCHANTS, merchantId);
}

export type RestaurantEdits = Partial<{
  name: string;
  tagline: string;
  cuisines: string[];
  address: string;
  phone: string;
  deliveryFee: number;
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
 */
export async function updateRestaurant(
  merchantId: string,
  edits: RestaurantEdits
): Promise<void> {
  if (!isFirebaseReady()) return;
  await updateDoc(doc(collection(getFirestore(getApp()), MERCHANTS), merchantId), edits);
}

/** Open or close a restaurant for orders. */
export async function setRestaurantOpen(merchantId: string, isOpen: boolean): Promise<void> {
  if (!isFirebaseReady()) return;
  await updateDoc(doc(collection(getFirestore(getApp()), MERCHANTS), merchantId), { isOpen });
}
