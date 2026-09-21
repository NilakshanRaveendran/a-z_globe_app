import { collection, doc, getFirestore, updateDoc } from '@react-native-firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import type { Order, OrderStatus } from '@modules/food/types';
import { normalizeOrder } from '@modules/food/services/orders';
import { countOfferUse } from './offers';

/**
 * Supplier-side reads and writes for the orders placed with a restaurant.
 *
 * This is the other half of the order loop. A customer creates the document;
 * only the owning supplier can move it, and only one step at a time.
 *
 * On Spark there is no Cloud Function here either, so the state machine is
 * enforced by `firestore.rules`: it checks `ownsMerchant()`, that ONLY
 * `status` and `timeline` changed, that the transition is legal, and that
 * exactly one timeline entry was appended naming the new status. The table
 * below mirrors that rule — if the two ever disagree, the rules win and the
 * write is simply refused.
 */

const ORDERS = 'orders';

/** Mirrors `validTransition()` in firestore.rules. */
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: 'accepted', label: 'Accept Order' },
  accepted: { to: 'preparing', label: 'Start Preparing' },
  preparing: { to: 'ready_for_pickup', label: 'Mark as Ready' },
  ready_for_pickup: { to: 'picked_up', label: 'Mark Picked Up' },
  picked_up: { to: 'delivered', label: 'Mark Delivered' },
};

/** The single forward step available from a status, or null at the end. */
export function nextStep(status: OrderStatus): { to: OrderStatus; label: string } | null {
  return NEXT[status] ?? null;
}

/** Statuses that still need the restaurant to do something. */
export const ACTIVE_STATUSES: OrderStatus[] = [
  'new',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'picked_up',
];

export function canCancel(status: OrderStatus): boolean {
  // Matches the rules: cancellation is allowed up to and including
  // ready_for_pickup, never once the rider has it.
  return ['new', 'accepted', 'preparing', 'ready_for_pickup'].includes(status);
}

/**
 * Orders for one restaurant, newest first.
 *
 * Bounded like every other list query. The composite index for
 * (merchantId, status, createdAt) is declared in firestore.indexes.json.
 */
export async function listMerchantOrders(
  merchantId: string,
  statuses?: OrderStatus[],
  limit = 40
): Promise<Order[]> {
  if (!isFirebaseReady() || !merchantId) return [];
  const { rows } = await readCollection<Order>(ORDERS, {
    where: [['merchantId', '==', merchantId]],
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit,
  });
  // `createdAt` arrives as a Firestore Timestamp; every caller here does date
  // maths on it, so normalise before anything downstream compares it.
  const orders = rows.map((o) => normalizeOrder(o)).filter((o): o is Order => o !== null);
  // Firestore cannot combine an `in` filter with this ordering without another
  // index, and the result set is already bounded, so the status filter is
  // applied here rather than in the query.
  return statuses ? orders.filter((o) => statuses.includes(o.status)) : orders;
}

/** Finished orders — what Order History lists. */
export const HISTORY_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

/**
 * Finished orders for one restaurant, newest first, optionally within
 * [from, to) in epoch ms.
 *
 * Uses the same (merchantId, createdAt desc) index as `listMerchantOrders`: an
 * equality on merchantId plus a range on the ordered field needs nothing more.
 * `createdAt` is a server Timestamp, so the bounds go in as Dates — a number
 * would compare against nothing and silently return no rows.
 */
export async function listOrderHistory(
  merchantId: string,
  range?: { from: number; to: number },
  limit = 200
): Promise<Order[]> {
  if (!isFirebaseReady() || !merchantId) return [];
  const where: Array<[string, '==' | '>=' | '<', unknown]> = [['merchantId', '==', merchantId]];
  if (range) {
    where.push(['createdAt', '>=', new Date(range.from)]);
    where.push(['createdAt', '<', new Date(range.to)]);
  }
  const { rows } = await readCollection<Order>(ORDERS, {
    where,
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit,
  });
  return rows
    .map((o) => normalizeOrder(o))
    .filter((o): o is Order => o !== null && HISTORY_STATUSES.includes(o.status));
}

/**
 * Move an order one step along the lifecycle.
 *
 * Writes `status` and an appended `timeline` entry together, and nothing else —
 * any other field in the same update makes the rules refuse the whole write.
 */
export async function advanceOrder(order: Order, to: OrderStatus): Promise<void> {
  if (!isFirebaseReady()) return;
  await updateDoc(doc(collection(getFirestore(getApp()), ORDERS), order.id), {
    status: to,
    timeline: [...(order.timeline ?? []), { status: to, at: Date.now() }],
  });
  // Accepting is the moment an offer counts as used — a cancelled-before-accept
  // order never claimed it. Separate write: the order rules allow nothing but
  // status and timeline in the order update.
  if (to === 'accepted') await countOfferUse(order.promoCode);
}

export const cancelOrder = (order: Order) => advanceOrder(order, 'cancelled');

/** The badge colours Figma gives each status on the order card (335:4972). */
export const STATUS_STYLE: Record<OrderStatus, { label: string; color: string; tint: string }> = {
  new: { label: 'New order', color: '#F59E0B', tint: '#FEF3C7' },
  accepted: { label: 'Accepted', color: '#0288D1', tint: '#E1F5FE' },
  preparing: { label: 'Preparing', color: '#7B1FA2', tint: '#F3E5F5' },
  ready_for_pickup: { label: 'Ready', color: '#16A34A', tint: '#DCFCE7' },
  picked_up: { label: 'Picked up', color: '#D42B2B', tint: '#FFF1F1' },
  delivered: { label: 'Delivered', color: '#6B7280', tint: '#F3F4F6' },
  cancelled: { label: 'Cancelled', color: '#6B7280', tint: '#F3F4F6' },
  refunded: { label: 'Refunded', color: '#6B7280', tint: '#F3F4F6' },
};
