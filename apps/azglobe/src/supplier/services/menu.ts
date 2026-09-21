import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import type { MenuItem } from '@modules/food/types';

/**
 * Supplier-side writes for a restaurant's menu.
 *
 * Dishes live under the restaurant that serves them, so every path here is
 * `merchants/{merchantId}/menuItems`. `firestore.rules` guards the whole
 * subcollection with `ownsMerchant()`, which requires the caller to hold a
 * supplier profile AND to be named on the restaurant — a customer uid gets
 * nothing here even if it somehow reached this code.
 */

const path = (merchantId: string) => `merchants/${merchantId}/menuItems`;

export type NewMenuItem = {
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

/**
 * Every dish on the menu, including unavailable ones.
 *
 * Deliberately different from the customer-facing `listMenuItems`, which hides
 * anything unavailable. A supplier must see the dish they just switched off in
 * order to switch it back on.
 */
export async function listAllMenuItems(merchantId: string): Promise<MenuItem[]> {
  if (!isFirebaseReady() || !merchantId) return [];
  const { rows } = await readCollection<MenuItem>(path(merchantId), {
    orderBy: { field: 'name', direction: 'asc' },
    limit: 100,
  });
  return rows;
}

export async function createMenuItem(
  merchantId: string,
  merchantName: string,
  input: NewMenuItem
): Promise<string> {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured.');

  const id = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const item: Omit<MenuItem, 'id'> = {
    merchantId,
    merchantName,
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    category: input.category.trim(),
    image: input.image,
    // Earned, not declared — the same reasoning as a restaurant's rating. A
    // dish starts unrated and unbadged; reviews move it.
    rating: 0,
    isBestseller: false,
    available: true,
    optionGroups: [],
  };

  await setDoc(doc(collection(getFirestore(getApp()), path(merchantId)), id), item);
  return id;
}

/** The "Make it unavailable" action on the menu card (176:2923). */
export async function setMenuItemAvailable(
  merchantId: string,
  itemId: string,
  available: boolean
): Promise<void> {
  if (!isFirebaseReady()) return;
  await updateDoc(doc(collection(getFirestore(getApp()), path(merchantId)), itemId), {
    available,
  });
}

export async function deleteMenuItem(merchantId: string, itemId: string): Promise<void> {
  if (!isFirebaseReady()) return;
  await deleteDoc(doc(collection(getFirestore(getApp()), path(merchantId)), itemId));
}
