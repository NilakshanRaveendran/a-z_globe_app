import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  setDoc,
  updateDoc,
} from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import type { MenuItem } from '@modules/food/types';
import { readDemoMenu, writeDemoMenu } from '@modules/food/services/demoCatalogue';

/**
 * Supplier-side writes for a restaurant's menu.
 *
 * Dishes live under the restaurant that serves them, so every path here is
 * `merchants/{merchantId}/menuItems`. `firestore.rules` guards the whole
 * subcollection with `ownsMerchant()`, which requires the caller to hold a
 * supplier profile AND to be named on the restaurant — a customer uid gets
 * nothing here even if it somehow reached this code.
 *
 * Without a Firebase config the app runs in demo mode against the shared demo
 * catalogue (`@modules/food/services/demoCatalogue`), which the customer side
 * reads too — a dish switched off here disappears from the customer menu. The
 * two restaurants the demo business owns start from their Figma dishes; a
 * restaurant created through Add Restaurant starts with an empty menu (audit
 * S4), so "No dishes yet" is reachable.
 */

const path = (merchantId: string) => `merchants/${merchantId}/menuItems`;

export type NewMenuItem = {
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
};

/**
 * The categories a new menu starts with — the Add New Item chips (463:2991),
 * in the order the Menu Management filter row draws them (176:2923).
 */
export const MENU_CATEGORIES = ['Burgers', 'Pizza', 'Sushi', 'Salads', 'Desserts', 'Drinks'];

/** "Burger", "burgers " and "Burgers" are one category. */
export function categoryKey(category: string): string {
  return category.trim().toLowerCase().replace(/s$/, '');
}

/**
 * De-duplicate categories (by `categoryKey`, first spelling wins) and order
 * them the way the design does: the standard ones first, anything the supplier
 * invented after, in the order given.
 */
export function orderCategories(categories: string[]): string[] {
  const rank = (c: string) => {
    const i = MENU_CATEGORIES.findIndex((d) => categoryKey(d) === categoryKey(c));
    return i === -1 ? MENU_CATEGORIES.length : i;
  };
  const seen = new Set<string>();
  const unique = categories
    .map((c) => c.trim())
    .filter((c) => {
      const key = categoryKey(c);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return unique
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

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

function buildItem(
  merchantId: string,
  merchantName: string,
  input: NewMenuItem
): Omit<MenuItem, 'id'> {
  return {
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
}

// ── Demo mode ──────────────────────────────────────────────────────────────

/** The stored menu — see `readDemoMenu` for what a restaurant starts with. */
async function demoMenu(merchantId: string): Promise<MenuItem[]> {
  return readDemoMenu(merchantId);
}

async function editDemoMenu(
  merchantId: string,
  change: (items: MenuItem[]) => MenuItem[]
): Promise<void> {
  writeDemoMenu(merchantId, change(await demoMenu(merchantId)));
}

// ── Reads and writes ───────────────────────────────────────────────────────

/**
 * Every dish on the menu, including unavailable ones.
 *
 * Deliberately different from the customer-facing `listMenuItems`, which hides
 * anything unavailable. A supplier must see the dish they just switched off in
 * order to switch it back on.
 */
export async function listAllMenuItems(merchantId: string): Promise<MenuItem[]> {
  if (!merchantId) return [];
  if (!isFirebaseReady()) return demoMenu(merchantId);
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
  const id = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const item = buildItem(merchantId, merchantName, input);

  if (!isFirebaseReady()) {
    await editDemoMenu(merchantId, (items) => [...items, { id, ...item }]);
    return id;
  }
  await setDoc(doc(collection(getFirestore(getApp()), path(merchantId)), id), item);
  return id;
}

/** Edit a dish from the pencil on its menu card (176:2923). */
export async function updateMenuItem(
  merchantId: string,
  itemId: string,
  input: NewMenuItem
): Promise<void> {
  const edits = {
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    category: input.category.trim(),
    image: input.image,
  };
  if (!isFirebaseReady()) {
    await editDemoMenu(merchantId, (items) =>
      items.map((item) => (item.id === itemId ? { ...item, ...edits } : item))
    );
    return;
  }
  await updateDoc(doc(collection(getFirestore(getApp()), path(merchantId)), itemId), edits);
}

/** The "Make it unavailable" action on the menu card (176:2923). */
export async function setMenuItemAvailable(
  merchantId: string,
  itemId: string,
  available: boolean
): Promise<void> {
  if (!isFirebaseReady()) {
    await editDemoMenu(merchantId, (items) =>
      items.map((item) => (item.id === itemId ? { ...item, available } : item))
    );
    return;
  }
  await updateDoc(doc(collection(getFirestore(getApp()), path(merchantId)), itemId), {
    available,
  });
}

export async function deleteMenuItem(merchantId: string, itemId: string): Promise<void> {
  if (!isFirebaseReady()) {
    await editDemoMenu(merchantId, (items) => items.filter((item) => item.id !== itemId));
    return;
  }
  await deleteDoc(doc(collection(getFirestore(getApp()), path(merchantId)), itemId));
}
