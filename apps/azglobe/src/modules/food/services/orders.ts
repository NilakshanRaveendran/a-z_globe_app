import { createMMKV } from 'react-native-mmkv';
import { getAuth } from '@react-native-firebase/auth';
import { addDoc, collection, getFirestore, serverTimestamp } from '@react-native-firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection, readDoc, watchDoc } from '@core/firebase/db';
import { orderSnapshot } from './addresses';
import type { Address, CartLine, DeliveryMode, Merchant, Order } from '../types';

const PRIORITY_FEE = 150;

/**
 * Minutes from placing the order to the door, for the delivery mode chosen at
 * checkout. Checkout shows these on the mode tiles and the order stores the
 * same window as etaFrom/etaTo, so Order Placed and tracking repeat exactly
 * what the customer picked. A scheduled order has no time picker yet and is
 * quoted as standard.
 */
export function deliveryWindow(
  merchant: Pick<Merchant, 'prepTimeMin' | 'prepTimeMax'>,
  mode: DeliveryMode
): { min: number; max: number } {
  if (mode === 'priority') {
    return { min: Math.max(5, merchant.prepTimeMin - 5), max: Math.max(10, merchant.prepTimeMax - 5) };
  }
  return { min: merchant.prepTimeMin + 5, max: merchant.prepTimeMax + 10 };
}

/**
 * Orders created before a Firebase project existed carry this prefix. The id is
 * persisted, so without this check the app would come back after Firebase is
 * wired up and try to read `orders/local-1789…` from Firestore — a document
 * that cannot exist, and whose rule dereferences a null `resource`.
 */
const LOCAL_ID_PREFIX = 'local-';
const isLocalId = (id: string) => id.startsWith(LOCAL_ID_PREFIX);

export type PlaceOrderInput = {
  merchant: Merchant;
  /** Snapshotted onto the order — see Order.userName. */
  userName: string;
  /**
   * Where it goes. Snapshotted onto the order because the restaurant cannot
   * read the customer's address book, and because editing a saved address
   * later must not move an order already on its way.
   */
  address: Address;
  lines: CartLine[];
  deliveryMode: DeliveryMode;
  requestUtensils: boolean;
  noteToRestaurant?: string;
  promoCode?: string;
  promoDiscount: number;
};

/**
 * Place an order.
 *
 * ┌─ SECURITY: READ BEFORE CHANGING ────────────────────────────────────────┐
 * │ The order document is written by the CLIENT, because Cloud Functions    │
 * │ require the Blaze plan and this project runs on Spark (free).           │
 * │                                                                        │
 * │ `firestore.rules` validates everything the rules language can reach:    │
 * │ the author is the signed-in user, the status starts at 'new', the       │
 * │ merchant exists and is open, the delivery fee matches that merchant's   │
 * │ own document, and the order is immutable to clients afterwards.         │
 * │                                                                        │
 * │ What it CANNOT validate is the item subtotal: rules have no loops, so   │
 * │ there is no way to sum `items[]` against the menu documents. A modified │
 * │ client could therefore understate the subtotal.                         │
 * │                                                                        │
 * │ The fix is `placeOrder` in functions/src/index.ts, which is written and │
 * │ recomputes every price server-side. Deploying it on Blaze and switching │
 * │ this function back to the callable is the only change needed — the      │
 * │ request shape below is already the one it expects.                      │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Without a Firebase project at all, the same shape is produced locally so the
 * flow stays walkable.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (!isFirebaseReady()) return buildLocalOrder(input);

  const uid = getAuth(getApp()).currentUser?.uid;
  if (!uid) throw new Error('Sign in to place an order.');

  const draft = buildOrderPayload(input, uid);
  const ref = await addDoc(collection(getFirestore(getApp()), 'orders'), {
    ...draft,
    createdAt: serverTimestamp(),
  });

  return { id: ref.id, ...draft } as Order;
}

/** The persisted order, minus the id and server timestamp. */
function buildOrderPayload(input: PlaceOrderInput, uid: string) {
  const now = Date.now();
  const subtotal = input.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const priorityFee = input.deliveryMode === 'priority' ? PRIORITY_FEE : 0;
  const deliveryFee = input.merchant.deliveryFee;

  return {
    module: 'food' as const,
    ref: `AZG-${String(now).slice(-4)}`,
    userId: uid,
    userName: input.userName,
    merchantId: input.merchant.id,
    merchantName: input.merchant.name,
    items: input.lines.map(({ lineId: _lineId, ...rest }) => ({
      ...rest,
      lineTotal: rest.unitPrice * rest.qty,
    })),
    orderType: 'delivery' as const,
    address: orderSnapshot(input.address),
    dropoffOption: input.address.dropoffOption,
    requestUtensils: input.requestUtensils,
    noteToRestaurant: input.noteToRestaurant ?? null,
    deliveryMode: input.deliveryMode,
    pricing: {
      subtotal,
      deliveryFee,
      priorityFee,
      promoDiscount: input.promoDiscount,
      total: Math.max(0, subtotal - input.promoDiscount) + deliveryFee + priorityFee,
      currency: 'LKR' as const,
    },
    promoCode: input.promoCode ?? null,
    paymentMethod: 'Visa ····7309',
    status: 'new' as const,
    timeline: [{ status: 'new' as const, at: now }],
    etaFrom: now + deliveryWindow(input.merchant, input.deliveryMode).min * 60_000,
    etaTo: now + deliveryWindow(input.merchant, input.deliveryMode).max * 60_000,
  };
}

/**
 * The signed-in customer's most recent order, if it is still in progress.
 *
 * The Home tracker remembers its order in on-device storage, which a reinstall,
 * a new phone or signing in again wipes — the customer would lose sight of an
 * order that is still on its way. Home calls this when it has no pointer; one
 * indexed read (userId, createdAt desc) recovers it.
 */
export async function findActiveOrder(): Promise<Order | null> {
  if (!isFirebaseReady()) return null;
  const uid = getAuth(getApp()).currentUser?.uid;
  if (!uid) return null;
  const { rows } = await readCollection<Order>('orders', {
    where: [['userId', '==', uid]],
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: 1,
  });
  const latest = normalizeOrder(rows[0] ?? null);
  return latest && !['delivered', 'cancelled', 'refunded'].includes(latest.status) ? latest : null;
}

export async function getOrder(orderId: string): Promise<Order | null> {
  // Same rule as `watchOrder`: a design-mode order is invisible once a real
  // Firebase project is configured, because it refers to fixture restaurants
  // that are not in the catalogue.
  if (isFirebaseReady()) {
    return isLocalId(orderId) ? null : normalizeOrder(await readDoc<Order>('orders', orderId));
  }
  return readLocalOrder(orderId);
}

/**
 * Firestore hands back `serverTimestamp()` fields as Timestamp objects, but the
 * `Order` type — and everything that does date arithmetic on it — expects epoch
 * milliseconds. Without this, `order.etaFrom - order.createdAt` silently
 * produced nonsense (an ETA of 28,761,542 minutes on the Order Placed screen).
 */
/**
 * Firestore returns `serverTimestamp()` fields as Timestamp objects, not
 * numbers. Exported because the supplier screens read the same documents and
 * hit the same trap — comparing a Timestamp to a number silently yields false,
 * which made "Orders Today" report zero on a day with orders.
 */
export function normalizeOrder(order: Order | null): Order | null {
  if (!order) return null;

  const toMillis = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && 'toMillis' in v) {
      return (v as { toMillis: () => number }).toMillis();
    }
    return 0;
  };

  return {
    ...order,
    createdAt: toMillis(order.createdAt),
    etaFrom: toMillis(order.etaFrom),
    etaTo: toMillis(order.etaTo),
    timeline: (order.timeline ?? []).map((t) => ({ ...t, at: toMillis(t.at) })),
  };
}

/**
 * Live order tracking. This is the app's only realtime listener — the caller
 * must detach it on blur so at most one stream is ever open.
 */
export function watchOrder(orderId: string, onChange: (order: Order | null) => void): () => void {
  if (isFirebaseReady()) {
    // A `local-` order belongs to design mode — it was written to MMKV when no
    // Firebase project was configured, against fixture restaurants. Once a real
    // project IS configured it must never surface again: it outlives the data it
    // refers to, so the Home card would advertise a restaurant that no longer
    // exists and an order nobody can fulfil. Report it as gone and let
    // `useOrderTracking` clear the pointer.
    if (isLocalId(orderId)) {
      onChange(null);
      return () => {};
    }
    return watchDoc<Order>('orders', orderId, (next) => onChange(normalizeOrder(next)));
  }
  onChange(readLocalOrder(orderId));
  return () => {};
}

/** The payload `functions/src/index.ts#placeOrder` expects, kept in step so
 *  moving back to the callable is a one-line change in placeOrder above. */
export type PlaceOrderRequest = {
  merchantId: string;
  items: Array<{ menuItemId: string; qty: number; selectedOptionIds: string[] }>;
  orderType: 'delivery' | 'pickup';
  deliveryMode: DeliveryMode;
  requestUtensils: boolean;
  noteToRestaurant?: string;
  promoCode?: string;
  /** Sent so the function can flag a mismatch, not so it can trust it. */
  clientTotal: number;
};

/** Builds the callable payload. Unused while orders are written client-side;
 *  kept and exported so switching back to the function is a one-line change. */
export function toRequest(input: PlaceOrderInput): PlaceOrderRequest {
  return {
    merchantId: input.merchant.id,
    items: input.lines.map((l) => ({
      menuItemId: l.menuItemId,
      qty: l.qty,
      selectedOptionIds: l.selectedOptions.map((o) => o.choiceId),
    })),
    orderType: 'delivery',
    deliveryMode: input.deliveryMode,
    requestUtensils: input.requestUtensils,
    noteToRestaurant: input.noteToRestaurant,
    promoCode: input.promoCode,
    clientTotal: totalFor(input),
  };
}

function totalFor(input: PlaceOrderInput): number {
  const subtotal = input.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const priority = input.deliveryMode === 'priority' ? PRIORITY_FEE : 0;
  return Math.max(0, subtotal - input.promoDiscount) + input.merchant.deliveryFee + priority;
}

/**
 * Local stand-in used only while Firebase is unconfigured.
 *
 * Persisted rather than held in memory: the Home screen's live-order card looks
 * up the order by id on every cold start, so an in-memory map would make the
 * card vanish whenever the app restarts.
 */
const orderStore = createMMKV({ id: 'azglobe.food.localOrders' });

function readLocalOrder(id: string): Order | null {
  const raw = orderStore.getString(id);
  return raw ? (JSON.parse(raw) as Order) : null;
}

function writeLocalOrder(order: Order): void {
  orderStore.set(order.id, JSON.stringify(order));
}

function buildLocalOrder(input: PlaceOrderInput): Order {
  const now = Date.now();
  const subtotal = input.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const priorityFee = input.deliveryMode === 'priority' ? PRIORITY_FEE : 0;
  const id = `${LOCAL_ID_PREFIX}${now}`;

  const order: Order = {
    id,
    module: 'food',
    ref: `AZG-${String(now).slice(-4)}`,
    userId: 'dev-vanan',
    userName: input.userName,
    merchantId: input.merchant.id,
    merchantName: input.merchant.name,
    items: input.lines.map(({ lineId: _lineId, ...rest }) => ({
      ...rest,
      lineTotal: rest.unitPrice * rest.qty,
    })),
    orderType: 'delivery',
    address: input.address,
    dropoffOption: input.address.dropoffOption,
    requestUtensils: input.requestUtensils,
    noteToRestaurant: input.noteToRestaurant,
    deliveryMode: input.deliveryMode,
    pricing: {
      subtotal,
      deliveryFee: input.merchant.deliveryFee,
      priorityFee,
      promoDiscount: input.promoDiscount,
      total: Math.max(0, subtotal - input.promoDiscount) + input.merchant.deliveryFee + priorityFee,
      currency: 'LKR',
    },
    promoCode: input.promoCode,
    paymentMethod: 'Visa ····7309',
    status: 'new',
    timeline: [{ status: 'new', at: now }],
    etaFrom: now + deliveryWindow(input.merchant, input.deliveryMode).min * 60_000,
    etaTo: now + deliveryWindow(input.merchant, input.deliveryMode).max * 60_000,
    createdAt: now,
  };

  writeLocalOrder(order);
  return order;
}
