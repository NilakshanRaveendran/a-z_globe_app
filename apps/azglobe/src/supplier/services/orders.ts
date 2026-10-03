import {
  collection,
  doc,
  getFirestore,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import { colors } from '@core/theme';
import { startOfDay } from '@core/utils/datetime';
import type { Address, Order, OrderStatus } from '@modules/food/types';
import {
  normalizeOrder,
  readDemoMerchantOrders,
  subscribeDemoOrders,
  updateDemoOrder,
  writeDemoMerchantOrders,
} from '@modules/food/services/orders';
import { findDemoRestaurant } from '@modules/food/services/demoCatalogue';
import { countOfferUse } from './offers';
import { isSeededDemoRestaurant } from './restaurants';
import { stageTransitions } from './orderSteps';
export { nextStep } from './orderSteps';

/**
 * Supplier-side reads and writes for the orders placed with a restaurant.
 *
 * This is the other half of the order loop. A customer creates the document;
 * only the owning supplier can move it, and only one step at a time.
 *
 * On Spark there is no Cloud Function here either, so the state machine is
 * enforced by `firestore.rules`: it checks `ownsMerchant()`, that ONLY
 * `status` and `timeline` changed (plus an optional `cancelReason` on a
 * cancel), that the transition is legal, and that exactly one timeline entry
 * was appended naming the new status. The table below mirrors that rule — if
 * the two ever disagree, the rules win and the write is simply refused.
 *
 * Without a Firebase config the app runs in demo mode: each restaurant's
 * orders live in the `azglobe-demo-orders:<merchantId>` store, which customer
 * checkout writes into (modules/food/services/orders.ts), so an order placed
 * on the personal account appears here and every step taken here shows on the
 * customer's tracker. The two owned fixture restaurants also get the Figma
 * sample orders; restaurants created through Add Restaurant start empty.
 * Firebase mode never touches it.
 */

const ORDERS = 'orders';

/** Mirrors `validTransition()` in firestore.rules. Labels are the OrderCard set's (335:5771). */
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: 'accepted', label: 'Accept Order' },
  accepted: { to: 'preparing', label: 'Start Preparing' },
  preparing: { to: 'ready_for_pickup', label: 'Mark as Ready' },
  ready_for_pickup: { to: 'picked_up', label: 'Mark as Picked Up' },
  picked_up: { to: 'delivered', label: 'Mark as Delivered' },
};

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

/** Finished orders — what Order History lists. */
export const HISTORY_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

/**
 * Why a restaurant turns an order down — offered when cancelling and stored
 * as `cancelReason`, so the customer's tracker can say more than "cancelled"
 * (audit S33). At most 120 characters (firestore.rules).
 */
export const CANCEL_REASONS = [
  'Items out of stock',
  'Kitchen too busy right now',
  'Closing soon',
  "Can't deliver to this address",
] as const;

// ── Demo mode ──────────────────────────────────────────────────────────────

const MIN = 60_000;

type SeedItem = { name: string; qty: number; unit: number };

/** The Figma sample basket: Chicken Kottu ×2 Rs. 900, Dosa ×1 Rs. 380 = Rs. 1,280. */
const SAMPLE: SeedItem[] = [
  { name: 'Chicken Kottu', qty: 2, unit: 450 },
  { name: 'Dosa', qty: 1, unit: 380 },
];
const SAMPLE_NOTE = 'Extra spicy please, no onions';

type Seed = {
  userName: string;
  phone: string;
  ref: number;
  status: OrderStatus;
  /** When it was placed, from the moment the demo set is first seeded. */
  placedAt: (now: number) => number;
  items?: SeedItem[];
  note?: string;
  line1?: string;
  payment?: string;
  mode?: 'priority' | 'scheduled';
  utensils?: boolean;
  cancelReason?: string;
};

const minutesAgo = (m: number) => (now: number) => now - m * MIN;
/** `h:mm` local time, `days` days before today. */
const dayAt = (days: number, h: number, m: number) => (now: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

const PRIORITY_FEE = 150;

/**
 * An owned restaurant's demo orders — every live status once (so each Active
 * Orders chip has something in it) plus ten finished ones spread over the
 * last fortnight the way Order History (346:3748) draws them: 7 delivered and
 * 3 cancelled across Today, Yesterday and three earlier days. A few carry
 * Priority, a scheduled time, utensils and card payment so the kitchen sees
 * every chip the customer can choose (audit C11).
 */
const SEEDS: Seed[] = [
  // Active Orders (335:4972) top to bottom.
  { userName: 'Arun Kumar', phone: '077 412 3380', ref: 1042, status: 'new', placedAt: minutesAgo(3), note: SAMPLE_NOTE },
  {
    userName: 'Kumar',
    phone: '071 556 2019',
    ref: 1041,
    status: 'new',
    placedAt: minutesAgo(6),
    line1: '45 Main Street',
    mode: 'priority',
    payment: 'Visa ····7309',
    utensils: true,
  },
  { userName: 'Yash', phone: '076 220 9154', ref: 1040, status: 'preparing', placedAt: minutesAgo(14), note: SAMPLE_NOTE },
  {
    userName: 'Priya Nadarajah',
    phone: '077 830 4471',
    ref: 1039,
    status: 'accepted',
    placedAt: minutesAgo(19),
    items: [
      { name: 'Chicken Biryani', qty: 1, unit: 1150 },
      { name: 'Mango Lassi', qty: 1, unit: 250 },
    ],
    line1: '7 Inner Harbour Road',
    mode: 'scheduled',
  },
  {
    userName: 'Nimal Perera',
    phone: '070 118 6632',
    ref: 1038,
    status: 'ready_for_pickup',
    placedAt: minutesAgo(27),
    items: [
      { name: 'Egg Hoppers', qty: 3, unit: 120 },
      { name: 'Dhal Curry', qty: 1, unit: 220 },
    ],
    note: 'Please pack the curry separately',
    utensils: true,
  },
  {
    userName: 'Fathima Rizwan',
    phone: '075 901 2248',
    ref: 1037,
    status: 'picked_up',
    placedAt: minutesAgo(41),
    items: [
      { name: 'Vegetable Kottu', qty: 1, unit: 750 },
      { name: 'Iced Milo', qty: 2, unit: 200 },
    ],
    line1: '18 Dockyard Road',
    payment: 'Visa ····7309',
  },

  // Order History (346:3748).
  { userName: 'Arun Kumar', phone: '077 412 3380', ref: 1036, status: 'delivered', placedAt: minutesAgo(75), note: SAMPLE_NOTE },
  {
    userName: 'Arun Kumar',
    phone: '077 412 3380',
    ref: 1031,
    status: 'cancelled',
    placedAt: dayAt(1, 20, 2),
    note: SAMPLE_NOTE,
    cancelReason: 'Kitchen too busy right now',
  },
  {
    userName: 'Tharsha Sivakumar',
    phone: '077 645 0913',
    ref: 1029,
    status: 'delivered',
    placedAt: dayAt(1, 13, 26),
    items: [{ name: 'Chicken Fried Rice', qty: 2, unit: 850 }],
  },
  { userName: 'Arun Kumar', phone: '077 412 3380', ref: 1024, status: 'delivered', placedAt: dayAt(4, 20, 2), note: SAMPLE_NOTE },
  {
    userName: 'Dilan Fernando',
    phone: '071 339 7705',
    ref: 1022,
    status: 'delivered',
    placedAt: dayAt(4, 19, 12),
    items: [
      { name: 'Seafood Kottu', qty: 1, unit: 1100 },
      { name: 'Lime Juice', qty: 1, unit: 180 },
    ],
  },
  {
    userName: 'Meena Ravi',
    phone: '076 507 1182',
    ref: 1020,
    status: 'delivered',
    placedAt: dayAt(4, 13, 41),
    items: [{ name: 'Masala Dosa', qty: 2, unit: 420 }],
  },
  { userName: 'Kavin Raj', phone: '078 224 6617', ref: 1019, status: 'cancelled', placedAt: dayAt(4, 12, 15) },
  { userName: 'Sanjay Mohan', phone: '077 118 0045', ref: 1011, status: 'delivered', placedAt: dayAt(9, 19, 48) },
  {
    userName: 'Yash',
    phone: '076 220 9154',
    ref: 1004,
    status: 'delivered',
    placedAt: dayAt(12, 20, 20),
    items: [{ name: 'Chicken Biryani', qty: 2, unit: 1150 }],
  },
  { userName: 'Kumar', phone: '071 556 2019', ref: 1002, status: 'cancelled', placedAt: dayAt(12, 18, 5) },
];

/**
 * Where each seeded restaurant's refs start, so two restaurants never both
 * list "#1042" (audit S4). Mama's Kitchen keeps the Figma numbers.
 */
function refBase(merchantId: string): number {
  if (merchantId === 'mamas-kitchen') return 1000;
  if (merchantId === 'yaal-angaadi') return 2000;
  let hash = 0;
  for (const ch of merchantId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 3000 + (hash % 7) * 1000;
}

/** The statuses an order passes through on its way to `status`. */
function pathTo(status: OrderStatus): OrderStatus[] {
  if (status === 'cancelled' || status === 'refunded') return ['new', 'cancelled'];
  const path: OrderStatus[] = ['new'];
  let at: OrderStatus = 'new';
  while (at !== status) {
    const next: OrderStatus | undefined = NEXT[at]?.to;
    if (!next) break;
    at = next;
    path.push(at);
  }
  return path;
}

function seedDemoOrders(merchantId: string, merchantName: string, now: number): Order[] {
  const base = refBase(merchantId);
  return SEEDS.map((seed, i) => {
    const createdAt = seed.placedAt(now);
    const items = (seed.items ?? SAMPLE).map((it) => ({
      menuItemId: `demo-${it.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      merchantId,
      name: it.name,
      image: '',
      qty: it.qty,
      unitPrice: it.unit,
      selectedOptions: [],
      lineTotal: it.qty * it.unit,
    }));
    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const priorityFee = seed.mode === 'priority' ? PRIORITY_FEE : 0;
    const address: Address = {
      id: `demo-address-${i}`,
      label: 'Home',
      line1: seed.line1 ?? '12 Beach Road',
      city: 'Trincomalee',
      buildingType: 'house',
      dropoffOption: 'door',
    };
    // Each step a few minutes after the last, never later than "now".
    const timeline = pathTo(seed.status).map((status, step) => ({
      status,
      at: Math.min(now, createdAt + step * 4 * MIN),
      ...(status === 'cancelled' ? { by: 'restaurant' as const } : {}),
    }));
    return {
      id: `demo-${merchantId}-${seed.ref}`,
      module: 'food',
      ref: `AZG-${base + (seed.ref - 1000)}`,
      userId: `demo-customer-${i}`,
      userName: seed.userName,
      userPhone: seed.phone,
      merchantId,
      merchantName,
      items,
      orderType: 'delivery',
      address,
      dropoffOption: 'door',
      ...(seed.note ? { noteToRestaurant: seed.note } : {}),
      requestUtensils: seed.utensils ?? false,
      deliveryMode: seed.mode ?? 'standard',
      ...(seed.mode === 'scheduled' ? { scheduledFor: createdAt + 90 * MIN } : {}),
      pricing: {
        subtotal,
        deliveryFee: 0,
        priorityFee,
        promoDiscount: 0,
        total: subtotal + priorityFee,
        currency: 'LKR',
      },
      paymentMethod: seed.payment ?? 'Cash on delivery',
      status: seed.status,
      timeline,
      ...(seed.cancelReason ? { cancelReason: seed.cancelReason } : {}),
      // "8:02 PM" → "8:15 – 8:30 PM", as on the frame.
      etaFrom: createdAt + 13 * MIN,
      etaTo: createdAt + 28 * MIN,
      createdAt,
    } satisfies Order;
  });
}

/**
 * This restaurant's demo orders. The owned fixture restaurants get the Figma
 * samples the first time they are read — merged with any customer order that
 * arrived first. Any other restaurant holds only real (customer-placed)
 * orders; a generic sample set an older build invented for it is dropped.
 */
function demoOrders(merchantId: string): Order[] {
  const rows = readDemoMerchantOrders(merchantId) ?? [];
  const seedPrefix = `demo-${merchantId}-`;
  const hasSeed = rows.some((o) => o.id.startsWith(seedPrefix));
  if (isSeededDemoRestaurant(merchantId)) {
    if (hasSeed) {
      // Samples seeded by an older build all used the same refs; give them
      // this restaurant's range so two restaurants never both list "#1042".
      const base = refBase(merchantId);
      let changed = false;
      const fixed = rows.map((o) => {
        const n = o.id.startsWith(seedPrefix) ? Number(o.id.slice(seedPrefix.length)) : NaN;
        const ref = `AZG-${base + (n - 1000)}`;
        if (!Number.isFinite(n) || o.ref === ref) return o;
        changed = true;
        return { ...o, ref };
      });
      if (changed) writeDemoMerchantOrders(merchantId, fixed);
      return fixed;
    }
    const name = findDemoRestaurant(merchantId)?.name ?? '';
    const seeded = [...rows, ...seedDemoOrders(merchantId, name, Date.now())];
    writeDemoMerchantOrders(merchantId, seeded);
    return seeded;
  }
  if (!hasSeed) return rows;
  const real = rows.filter((o) => !o.id.startsWith(seedPrefix));
  writeDemoMerchantOrders(merchantId, real);
  return real;
}

const newestFirst = (a: Order, b: Order) => b.createdAt - a.createdAt;

const normalizeAll = (rows: Order[]) =>
  rows.map((o) => normalizeOrder(o)).filter((o): o is Order => o !== null);

// ── Reads ──────────────────────────────────────────────────────────────────

/**
 * Orders for one restaurant, newest first.
 *
 * With `statuses`, exactly the orders in those statuses — queried directly
 * (`status in …`, index merchantId + status + createdAt) rather than "newest
 * 40, then filter", which hid an older order still waiting on a busy day
 * (audit S3).
 *
 * Without, every order still in progress plus everything placed today, in
 * any status: what the dashboard and hub need for today's numbers and the
 * "N Active Orders Awaiting" alert, with no cap that could corrupt either.
 */
export async function listMerchantOrders(
  merchantId: string,
  statuses?: OrderStatus[],
  limit = 200
): Promise<Order[]> {
  if (!merchantId) return [];
  if (!statuses) {
    const [active, today] = await Promise.all([
      listMerchantOrders(merchantId, ACTIVE_STATUSES, limit),
      listTodayOrders(merchantId),
    ]);
    const byId = new Map([...today, ...active].map((o) => [o.id, o]));
    return [...byId.values()].sort(newestFirst);
  }
  if (!statuses.length) return [];
  if (!isFirebaseReady()) {
    return demoOrders(merchantId)
      .filter((o) => statuses.includes(o.status))
      .sort(newestFirst)
      .slice(0, limit);
  }
  const { rows } = await readCollection<Order>(ORDERS, {
    where: [
      ['merchantId', '==', merchantId],
      statuses.length === 1 ? ['status', '==', statuses[0]] : ['status', 'in', statuses],
    ],
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit,
  });
  // `createdAt` arrives as a Firestore Timestamp; every caller here does date
  // maths on it, so normalise before anything downstream compares it.
  return normalizeAll(rows);
}

/** Everything still in progress at one restaurant. */
export const listActiveOrders = (merchantId: string) => listMerchantOrders(merchantId, ACTIVE_STATUSES);

/** Recent completed orders, including orders placed before today. */
export const listClosedOrders = (merchantId: string) => listMerchantOrders(merchantId, ['delivered', 'cancelled', 'refunded']);

export const listCompletedOrders = (merchantId: string) => listMerchantOrders(merchantId, ['delivered']);

/**
 * Every order placed at one restaurant since local midnight, in any status —
 * the stats' own read, separate from the live list (audit S3).
 */
export async function listTodayOrders(merchantId: string, now = Date.now()): Promise<Order[]> {
  if (!merchantId) return [];
  const from = startOfDay(now);
  if (!isFirebaseReady()) {
    return demoOrders(merchantId)
      .filter((o) => o.createdAt >= from)
      .sort(newestFirst);
  }
  const { rows } = await readCollection<Order>(ORDERS, {
    where: [
      ['merchantId', '==', merchantId],
      // A server Timestamp compares against a Date, never a number.
      ['createdAt', '>=', new Date(from)],
    ],
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: 500,
  });
  return normalizeAll(rows);
}

/** Orders Today · Revenue · awaiting — how the stat cards count (audit S18). */
export type OrderStats = { ordersToday: number; revenue: number; active: number };

/** Accepted and later: the restaurant has committed to it, and it wasn't called off. */
const EARNING: OrderStatus[] = ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered'];

/**
 * Today's numbers from a set of orders (any mix of days and statuses):
 * Orders Today leaves out cancelled and refunded ones; Revenue counts only
 * orders accepted and later, never one still 'new' (it may yet be turned
 * down) and never a cancelled or refunded one; `active` counts every order
 * still in progress, whatever day it was placed.
 */
export function orderStats(orders: Order[], now = Date.now()): OrderStats {
  const from = startOfDay(now);
  const unique = [...new Map(orders.map((o) => [o.id, o])).values()];
  const today = unique.filter((o) => (o.createdAt ?? 0) >= from);
  return {
    ordersToday: today.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded').length,
    revenue: today
      .filter((o) => EARNING.includes(o.status))
      .reduce((sum, o) => sum + (o.pricing?.total ?? 0), 0),
    active: unique.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
  };
}

/** How often the demo-mode live list re-reads the store. */
const DEMO_POLL_MS = 3000;

/**
 * Live feed of the orders still in progress across `merchantIds` (audit S1).
 *
 * Firebase: one `onSnapshot` per restaurant on `merchantId == … && status in
 * ACTIVE`, the same indexed query as `listActiveOrders`, so a new order or a
 * step taken on another device lands within a second. The caller attaches it
 * while the screen is focused and detaches on blur.
 *
 * Demo: re-reads the shared demo store every three seconds and on `storage`
 * events from other tabs.
 *
 * `onChange` receives every active order, newest first. `onError` fires when
 * a stream fails; the other restaurants keep streaming.
 */
export function watchActiveOrders(
  merchantIds: string[],
  onChange: (orders: Order[]) => void,
  onError?: (error: unknown) => void
): () => void {
  return watchOrdersByStatus(merchantIds, ACTIVE_STATUSES, onChange, onError);
}

/** Completion is live too: it must not depend on a manual refresh or creation date. */
export function watchCompletedOrders(
  merchantIds: string[],
  onChange: (orders: Order[]) => void,
  onError?: (error: unknown) => void
): () => void {
  return watchOrdersByStatus(merchantIds, ['delivered'], onChange, onError);
}

/** Terminal orders stay live in both the Completed and Cancelled tabs. */
export function watchClosedOrders(
  merchantIds: string[],
  onChange: (orders: Order[]) => void,
  onError?: (error: unknown) => void
): () => void {
  return watchOrdersByStatus(merchantIds, ['delivered', 'cancelled', 'refunded'], onChange, onError);
}

function watchOrdersByStatus(
  merchantIds: string[],
  statuses: OrderStatus[],
  onChange: (orders: Order[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const ids = [...new Set(merchantIds.filter(Boolean))];
  if (!ids.length) {
    onChange([]);
    return () => {};
  }

  if (!isFirebaseReady()) {
    let last = '';
    const emit = () => {
      const rows = ids
        .flatMap((id) => demoOrders(id))
        .filter((o) => statuses.includes(o.status))
        .sort(newestFirst);
      const key = rows.map((o) => `${o.id}:${o.status}:${o.timeline?.length ?? 0}`).join('|');
      if (key === last) return;
      last = key;
      onChange(rows);
    };
    emit();
    const timer = setInterval(emit, DEMO_POLL_MS);
    const unsubscribe = subscribeDemoOrders(emit);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }

  const latest = new Map<string, Order[]>();
  // Restaurants whose stream has dropped. While any has, every emission is
  // followed by onError, so the screen never claims "Live" over stale orders.
  const failed = new Set<string>();
  let stopped = false;
  const emit = () => {
    if (latest.size < ids.length) return; // wait until every stream has answered once
    onChange([...latest.values()].flat().sort(newestFirst));
    if (failed.size) onError?.(new Error('Some order streams are reconnecting.'));
  };
  const db = getFirestore(getApp());
  const stops = new Map<string, () => void>();
  const retries = new Map<string, ReturnType<typeof setTimeout>>();
  // A Firestore listener ends for good on its first error; re-attach with
  // backoff (2 s, 4 s … 30 s) until it answers again.
  const listen = (merchantId: string, attempt = 0) => {
    stops.set(
      merchantId,
      onSnapshot(
        query(
          collection(db, ORDERS),
          where('merchantId', '==', merchantId),
          where('status', 'in', statuses),
          orderBy('createdAt', 'desc'),
          fsLimit(200)
        ),
        (snap) => {
          if (stopped) return;
          attempt = 0;
          failed.delete(merchantId);
          const rows = (snap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as object) }) as Order);
          latest.set(merchantId, normalizeAll(rows));
          emit();
        },
        (error) => {
          if (stopped) return;
          failed.add(merchantId);
          latest.set(merchantId, latest.get(merchantId) ?? []);
          emit();
          onError?.(error);
          if (stopped) return;
          const delay = Math.min(30_000, 2_000 * 2 ** attempt);
          retries.set(merchantId, setTimeout(() => !stopped && listen(merchantId, attempt + 1), delay));
        }
      )
    );
  };
  ids.forEach((merchantId) => listen(merchantId));
  return () => {
    stopped = true;
    retries.forEach((timer) => clearTimeout(timer));
    stops.forEach((stop) => stop());
  };
}

/**
 * Finished orders for one restaurant, newest first, optionally within
 * [from, to) in epoch ms.
 *
 * Uses the (merchantId, createdAt desc) index: an equality on merchantId plus
 * a range on the ordered field needs nothing more. `createdAt` is a server
 * Timestamp, so the bounds go in as Dates — a number would compare against
 * nothing and silently return no rows.
 */
export async function listOrderHistory(
  merchantId: string,
  range?: { from: number; to: number },
  limit = 200
): Promise<Order[]> {
  if (!merchantId) return [];
  if (!isFirebaseReady()) {
    return demoOrders(merchantId)
      .filter(
        (o) =>
          HISTORY_STATUSES.includes(o.status) &&
          (!range || (o.createdAt >= range.from && o.createdAt < range.to))
      )
      .sort(newestFirst)
      .slice(0, limit);
  }
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
  return normalizeAll(rows).filter((o) => HISTORY_STATUSES.includes(o.status));
}

// ── Writes ─────────────────────────────────────────────────────────────────

/** The same test `validTransition()` applies in firestore.rules. */
function isLegalMove(from: OrderStatus, to: OrderStatus): boolean {
  return to === 'cancelled' ? canCancel(from) : NEXT[from]?.to === to;
}

const MOVED_ON = 'This order has already moved on. The list has been refreshed.';

/**
 * Move an order one step along the lifecycle.
 *
 * Writes `status` and an appended `timeline` entry together — plus, on a
 * cancel, the optional `cancelReason` — and nothing else: any other field in
 * the same update makes the rules refuse the whole write. `order` must be the
 * latest copy: the rules require the new timeline to be the stored one plus
 * exactly one entry.
 */
export async function advanceOrder(
  order: Order,
  to: OrderStatus,
  options: { reason?: string } = {}
): Promise<Order['timeline']> {
  const reason = to === 'cancelled' ? options.reason?.trim().slice(0, 120) : undefined;
  const entry = { status: to, at: Date.now(), ...(to === 'cancelled' ? { by: 'restaurant' as const } : {}) };

  if (!isFirebaseReady()) {
    // Checked against the stored copy, the way the rules check the document.
    demoOrders(order.merchantId); // make sure the list exists (seeded restaurants)
    const updated = updateDemoOrder(order.merchantId, order.id, (stored) => {
      if (!isLegalMove(stored.status, to)) throw new Error(MOVED_ON);
      return {
        ...stored,
        status: to,
        timeline: [...(stored.timeline ?? []), entry],
        ...(reason ? { cancelReason: reason } : {}),
      };
    });
    if (!updated) throw new Error('This order no longer exists.');
    // Accepting counts the offer as used, exactly as in Firebase mode.
    if (to === 'accepted') await countOfferUse(order.promoCode, order.merchantId);
    return updated.timeline;
  }

  const ref = doc(collection(getFirestore(getApp()), ORDERS), order.id);
  const change = { status: to, timeline: [...(order.timeline ?? []), entry] };
  try {
    await updateDoc(ref, reason ? { ...change, cancelReason: reason } : change);
  } catch (error) {
    // Rules deployed before `cancelReason` existed refuse the extra field;
    // the cancellation itself matters more than its reason.
    if (!reason) throw error;
    await updateDoc(ref, change);
  }
  // Accepting is the moment an offer counts as used — a cancelled-before-accept
  // order never claimed it. Separate write: the order rules allow nothing but
  // status and timeline in the order update.
  if (to === 'accepted') await countOfferUse(order.promoCode, order.merchantId);
  return change.timeline;
}

/** One staff action may cross several legacy statuses. Resume from the latest
 * stored status after a partial failure; never skip the database's rules. */
export async function advanceOrderStage(order: Order, to: OrderStatus): Promise<Order> {
  let current = order;
  for (const status of stageTransitions(order, to)) {
    const timeline = await advanceOrder(current, status);
    current = { ...current, status, timeline };
  }
  return current;
}

export const cancelOrder = (order: Order, reason?: string) => advanceOrder(order, 'cancelled', { reason });

/**
 * The status pill on the order card — OrderCard set (335:5771) and Order
 * History (346:3748). Picked up and Refunded have no frame of their own.
 */
export const STATUS_STYLE: Record<OrderStatus, { label: string; color: string; tint: string }> = {
  new: { label: 'New order', color: colors.palette.amber700, tint: colors.palette.amber50 },
  accepted: { label: 'Accepted', color: colors.palette.blue500, tint: colors.palette.blue50 },
  preparing: { label: 'Preparing', color: colors.palette.purple700, tint: colors.palette.purple100 },
  ready_for_pickup: {
    label: 'Ready for Pickup',
    color: colors.palette.orange600,
    tint: colors.palette.orange100,
  },
  picked_up: { label: 'Picked up', color: colors.palette.blue600, tint: colors.palette.sky50 },
  delivered: { label: 'Delivered', color: colors.success, tint: colors.palette.green25 },
  cancelled: { label: 'Cancelled', color: colors.primary, tint: colors.palette.red100 },
  refunded: { label: 'Refunded', color: colors.textSecondary, tint: colors.surfaceAlt },
};
