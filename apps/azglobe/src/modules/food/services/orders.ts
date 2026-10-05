import { createStorage } from '@core/storage';
import { getAuth } from '@core/firebase/auth';
import { collection, doc, getFirestore, serverTimestamp, setDoc, updateDoc } from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection, readDoc, watchDoc } from '@core/firebase/db';
import { formatClock, formatDayLabel } from '@core/utils/datetime';
import { orderSnapshot } from './addresses';
import { DEMO_CUSTOMER_ID, findDemoRestaurant } from './demoCatalogue';
import { isTerminalStatus, type Address, type CartLine, type DeliveryMode, type Merchant, type Order, type OrderStatus } from '../types';

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

/** The demo customer's number — SessionProvider's DESIGN_USER. */
const DEMO_PHONE = '071 110 9390';

// ── Errors the checkout maps to its own copy ──────────────────────────────

/** `error.code` of a RestaurantClosedError. */
export const RESTAURANT_CLOSED = 'restaurant-closed';

/**
 * The restaurant is not taking orders (closed, or archived by its owner).
 * Thrown before anything is written, so the cart is untouched (audit C13).
 */
export class RestaurantClosedError extends Error {
  readonly code = RESTAURANT_CLOSED;
  constructor(merchantName: string) {
    super(`${merchantName || 'This restaurant'} isn't taking orders right now. Please try again when it opens.`);
    this.name = 'RestaurantClosedError';
  }
}

export function isRestaurantClosedError(error: unknown): error is RestaurantClosedError {
  return (error as { code?: unknown } | null)?.code === RESTAURANT_CLOSED;
}

/** `error.code` when a customer tries to cancel an order the restaurant already took. */
export const ORDER_NOT_CANCELLABLE = 'order-not-cancellable';

export class OrderNotCancellableError extends Error {
  readonly code = ORDER_NOT_CANCELLABLE;
  constructor() {
    super('The restaurant has already started on this order, so it can no longer be cancelled here. Call the restaurant if you need to change it.');
    this.name = 'OrderNotCancellableError';
  }
}

// ── Placing an order ──────────────────────────────────────────────────────

/** A scheduled order is promised for this long after its slot starts. */
const SCHEDULED_SLOT_MS = 30 * 60_000;

/**
 * When the order should arrive. A scheduled order arrives in its slot
 * (slot → slot + 30 min), not 25–40 minutes after it was placed; everything
 * else uses the delivery window of the mode chosen at checkout.
 */
/** Takeaway is ready when the kitchen is done — the restaurant's own prep time. */
export function pickupWindow(merchant: Pick<Merchant, 'prepTimeMin' | 'prepTimeMax'>): { min: number; max: number } {
  return { min: merchant.prepTimeMin, max: merchant.prepTimeMax };
}

function etaFor(
  input: Pick<PlaceOrderInput, 'merchant' | 'deliveryMode' | 'scheduledFor' | 'orderType'>,
  now: number
) {
  if (input.deliveryMode === 'scheduled' && input.scheduledFor && input.scheduledFor > now) {
    return { etaFrom: input.scheduledFor, etaTo: input.scheduledFor + SCHEDULED_SLOT_MS };
  }
  const window =
    input.orderType === 'pickup' ? pickupWindow(input.merchant) : deliveryWindow(input.merchant, input.deliveryMode);
  return { etaFrom: now + window.min * 60_000, etaTo: now + window.max * 60_000 };
}

export type PlaceOrderInput = {
  merchant: Merchant;
  /** Snapshotted onto the order — see Order.userName. */
  userName: string;
  /**
   * Snapshotted onto the order so the restaurant can call — see Order.userPhone.
   * Defaults to the signed-in number (Firebase) or the demo customer's.
   */
  userPhone?: string;
  /**
   * Where it goes. Snapshotted onto the order because the restaurant cannot
   * read the customer's address book, and because editing a saved address
   * later must not move an order already on its way. Null for takeaway.
   */
  address: Address | null;
  /** Delivered to the address, or collected from the restaurant. Defaults to delivery. */
  orderType?: 'delivery' | 'pickup';
  /** Straight-line km to the address, when the restaurant prices or limits by distance. */
  deliveryDistanceKm?: number;
  lines: CartLine[];
  deliveryMode: DeliveryMode;
  requestUtensils: boolean;
  noteToRestaurant?: string;
  promoCode?: string;
  promoDiscount: number;
  /** The label of the method chosen in "Pay with", e.g. "Cash on delivery". */
  paymentMethod: string;
  /** Epoch millis — only for deliveryMode 'scheduled'. */
  scheduledFor?: number;
  /**
   * The order's id, from `newOrderId()` when checkout opens. Passing the same
   * id on a retry makes placing idempotent: a second attempt after a write
   * that did land returns that order instead of creating another (audit C42).
   */
  orderId?: string;
};

/** A fresh order id. Generate once per checkout and pass it as `orderId`. */
export function newOrderId(): string {
  if (isFirebaseReady()) return doc(collection(getFirestore(getApp()), 'orders')).id;
  return `${LOCAL_ID_PREFIX}${Date.now()}-${randomCode(4).toLowerCase()}`;
}

/** No 0/O, 1/I/L — the ref is read out over the phone. */
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomCode(length: number): string {
  const bytes = new Uint8Array(length);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

/**
 * "AZG-7K3Q9P" — the human reference on the track card and the kitchen's
 * ticket. Six characters from a 31-letter alphabet (~890M combinations), so
 * two orders at one restaurant practically never share one; the old four
 * digits of the clock collided every ten seconds (audit S37).
 */
export function newOrderRef(): string {
  return `AZG-${randomCode(6)}`;
}

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
 * │ own document, and the order is immutable to clients afterwards (bar the │
 * │ customer's own cancel while it is still 'new').                         │
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
 * Refuses a closed restaurant up front with a RestaurantClosedError. The id is
 * chosen on the client (`doc(collection)` + `setDoc`) so a retry cannot
 * create a duplicate.
 *
 * Without a Firebase project the order goes into the same demo store the
 * business Orders screens read, so it reaches the restaurant.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (!isFirebaseReady()) return placeDemoOrder(input);

  const auth = getAuth(getApp());
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in to place an order.');

  // One read for a clear answer: the rules would refuse a closed restaurant
  // anyway, but only as "Missing or insufficient permissions".
  const fresh = await readDoc<Merchant>('merchants', input.merchant.id).catch(() => null);
  if (fresh && (fresh.isOpen !== true || fresh.archived)) throw new RestaurantClosedError(input.merchant.name);

  const id = input.orderId ?? newOrderId();
  const phone = input.userPhone?.trim() || auth.currentUser?.phoneNumber || '';
  const draft = buildOrderPayload(input, uid, phone);
  const ref = doc(collection(getFirestore(getApp()), 'orders'), id);
  try {
    await setDoc(ref, { ...draft, createdAt: serverTimestamp() });
  } catch (error) {
    // A retry of a write that did land is refused as an update — the order is
    // there, so hand it back instead of failing.
    const existing = normalizeOrder(await readDoc<Order>('orders', id).catch(() => null));
    if (existing && existing.userId === uid) return existing;
    throw error;
  }
  return { id, ...draft, createdAt: Date.now() } as Order;
}

/** The persisted order, minus the id and server timestamp. Never holds undefined. */
function buildOrderPayload(input: PlaceOrderInput, uid: string, phone: string) {
  const now = Date.now();
  const subtotal = input.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const pickup = input.orderType === 'pickup' || !input.address;
  // Takeaway has no courier: no delivery fee (the rules insist) and no priority.
  const priorityFee = !pickup && input.deliveryMode === 'priority' ? PRIORITY_FEE : 0;
  const deliveryFee = pickup ? 0 : input.merchant.deliveryFee;
  const note = input.noteToRestaurant?.trim();

  return {
    module: 'food' as const,
    ref: newOrderRef(),
    userId: uid,
    userName: input.userName,
    ...(phone ? { userPhone: phone } : {}),
    merchantId: input.merchant.id,
    merchantName: input.merchant.name,
    items: input.lines.map(({ lineId: _lineId, merchantName: _merchantName, ...rest }) => ({
      ...rest,
      lineTotal: rest.unitPrice * rest.qty,
    })),
    orderType: pickup ? ('pickup' as const) : ('delivery' as const),
    address: pickup || !input.address ? null : orderSnapshot(input.address),
    dropoffOption: input.address?.dropoffOption ?? ('door' as const),
    ...(!pickup && input.deliveryDistanceKm != null
      ? { deliveryDistanceKm: Math.round(input.deliveryDistanceKm * 100) / 100 }
      : {}),
    requestUtensils: input.requestUtensils,
    noteToRestaurant: note ? note : null,
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
    paymentMethod: input.paymentMethod,
    ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
    status: 'new' as const,
    timeline: [{ status: 'new' as const, at: now }],
    ...etaFor({ ...input, orderType: pickup ? 'pickup' : 'delivery' }, now),
  };
}

// ── Reading orders ────────────────────────────────────────────────────────

/** Recover every in-progress order, including orders from earlier checkouts. */
export async function findActiveOrders(): Promise<Order[]> {
  if (!isFirebaseReady()) return demoMyOrders().filter((o) => !isTerminalStatus(o.status));
  const uid = getAuth(getApp()).currentUser?.uid;
  if (!uid) return [];
  const { rows } = await readCollection<Order>('orders', {
    where: [['userId', '==', uid], ['status', 'in', ['new', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up']]],
  });
  return rows.map(normalizeOrder).filter((o): o is Order => !!o && !isLocalId(o.id) && !isTerminalStatus(o.status))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** How many of the customer's orders My Orders lists. */
const MY_ORDERS_LIMIT = 50;

/**
 * The signed-in customer's orders, newest first — current and past. Bounded:
 * My Orders shows the latest fifty.
 */
export async function listMyOrders(): Promise<Order[]> {
  if (!isFirebaseReady()) return demoMyOrders();
  const uid = getAuth(getApp()).currentUser?.uid;
  if (!uid) return [];
  const { rows } = await readCollection<Order>('orders', {
    where: [['userId', '==', uid]],
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: MY_ORDERS_LIMIT,
  });
  return rows.map((o) => normalizeOrder(o)).filter((o): o is Order => o !== null && !isLocalId(o.id));
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
 * Firestore returns `serverTimestamp()` fields as Timestamp objects, not
 * numbers, but the `Order` type — and everything that does date arithmetic on
 * it — expects epoch milliseconds. Without this, `order.etaFrom -
 * order.createdAt` silently produced nonsense (an ETA of 28,761,542 minutes on
 * the Order Placed screen). Exported because the supplier screens read the
 * same documents and hit the same trap — comparing a Timestamp to a number
 * silently yields false, which made "Orders Today" report zero on a day with
 * orders.
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

/** How often a demo-mode tracker re-reads its order. */
const DEMO_POLL_MS = 2000;

/**
 * Live order tracking. In Firebase mode this is a realtime listener on the one
 * order document — the caller must detach it on blur. Home subscribes once
 * per tracked restaurant order. In demo mode it re-reads the shared demo store every two seconds
 * and on `storage` events from other tabs, so a status the business moves
 * shows up on the customer's tracker without a reload (audit C3).
 *
 * `onChange` fires once straight away and then only when the order changes.
 */
export function watchOrder(orderId: string, onChange: (order: Order | null) => void): () => void {
  if (isFirebaseReady()) {
    // A `local-` order belongs to design mode — it was written to on-device
    // storage when no Firebase project was configured, against fixture
    // restaurants. Once a real project IS configured it must never surface
    // again: it outlives the data it refers to, so the Home card would
    // advertise a restaurant that no longer exists and an order nobody can
    // fulfil. Report it as gone and let `useOrderTracking` clear the pointer.
    if (isLocalId(orderId)) {
      onChange(null);
      return () => {};
    }
    return watchDoc<Order>('orders', orderId, (next) => onChange(normalizeOrder(next)));
  }

  let last: string | null = null;
  const emit = () => {
    const order = readLocalOrder(orderId);
    const key = order ? `${order.status}:${order.timeline?.length ?? 0}` : 'gone';
    if (key === last) return;
    last = key;
    onChange(order);
  };
  emit();
  const timer = setInterval(emit, DEMO_POLL_MS);
  const unsubscribe = subscribeDemoOrders(emit);
  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}

// ── Cancelling ────────────────────────────────────────────────────────────

/** Whether the customer may still cancel — only before the restaurant accepts. */
export function canCustomerCancel(order: Pick<Order, 'status'>): boolean {
  return order.status === 'new';
}

/**
 * Cancel the customer's own order. Allowed only while it is still 'new' — the
 * rules check the stored status, so the latest copy is read first and an
 * order the restaurant has since accepted throws OrderNotCancellableError.
 * Writes `status` plus one appended timeline entry and nothing else.
 */
export async function cancelOrder(order: Order): Promise<void> {
  const entry = { status: 'cancelled' as const, at: Date.now(), by: 'customer' as const };
  if (!isFirebaseReady()) {
    const merchantId = demoIndex().find((e) => e.id === order.id)?.merchantId ?? order.merchantId;
    const updated = updateDemoOrder(merchantId, order.id, (stored) => {
      if (!canCustomerCancel(stored)) throw new OrderNotCancellableError();
      return { ...stored, status: 'cancelled', timeline: [...(stored.timeline ?? []), entry] };
    });
    if (!updated) throw new Error('This order could not be found.');
    return;
  }
  const latest = await readDoc<Order>('orders', order.id);
  if (!latest) throw new Error('This order could not be found.');
  if (!canCustomerCancel(latest)) throw new OrderNotCancellableError();
  await updateDoc(doc(collection(getFirestore(getApp()), 'orders'), order.id), {
    status: 'cancelled',
    // The stored timeline as-is (not normalised) plus exactly one entry — the
    // rules compare the prefix.
    timeline: [...(latest.timeline ?? []), entry],
  }).catch((e: unknown) => {
    // The restaurant accepted it between the read and this write: the rules
    // refuse a customer cancel once the order has moved on.
    const code = String((e as { code?: unknown } | null)?.code ?? '');
    if (code.includes('permission-denied')) throw new OrderNotCancellableError();
    throw e;
  });
}

// ── Display helpers shared by both sides ──────────────────────────────────

/** "8:02 PM" today, "Yesterday, 8:02 PM", or "25 Sep, 8:02 PM" (audit S19). */
export function formatOrderTime(ms: number, now = Date.now()): string {
  const day = formatDayLabel(ms, now);
  return day === 'Today' ? formatClock(ms) : `${day}, ${formatClock(ms)}`;
}

/** When the order reached `status`, from its timeline. */
export function timeOf(order: Pick<Order, 'timeline'>, status: OrderStatus): number | null {
  const hit = [...(order.timeline ?? [])].reverse().find((t) => t.status === status);
  return hit ? hit.at : null;
}

// ── Callable payload (unused on Spark) ────────────────────────────────────

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
    orderType: input.orderType ?? 'delivery',
    deliveryMode: input.deliveryMode,
    requestUtensils: input.requestUtensils,
    noteToRestaurant: input.noteToRestaurant,
    promoCode: input.promoCode,
    clientTotal: totalFor(input),
  };
}

function totalFor(input: PlaceOrderInput): number {
  const subtotal = input.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const pickup = input.orderType === 'pickup';
  const priority = !pickup && input.deliveryMode === 'priority' ? PRIORITY_FEE : 0;
  return Math.max(0, subtotal - input.promoDiscount) + (pickup ? 0 : input.merchant.deliveryFee) + priority;
}

// ── Demo mode ─────────────────────────────────────────────────────────────
//
// Without Firebase, an order lives in ONE place: the restaurant's list in the
// `azglobe-demo-orders:<merchantId>` store, the same list the business Orders
// screens read and advance (supplier/services/orders.ts). The customer keeps
// only an index of which orders are theirs, so both sides always see the same
// status (audit C3 / S2).
//
// Restaurants nobody operates (the read-only fixture ones) have no business
// account to move the order along, so their orders progress on a timer
// instead — accepted → preparing → ready → picked up → delivered over about
// four minutes — and the tracker still moves.

const demoOrderStore = createStorage({ id: 'azglobe-demo-orders' });
/** The web storage prefix of `demoOrderStore` — see `subscribeDemoOrders`. */
const DEMO_ORDERS_PREFIX = 'azglobe-demo-orders:';

/** One restaurant's demo orders as stored, or null when it has none yet. */
export function readDemoMerchantOrders(merchantId: string): Order[] | null {
  const raw = demoOrderStore.getString(merchantId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Order[]) : null;
  } catch {
    return null;
  }
}

export function writeDemoMerchantOrders(merchantId: string, orders: Order[]): void {
  demoOrderStore.set(merchantId, JSON.stringify(orders));
}

/**
 * Read-modify-write one stored order, synchronously so nothing can interleave.
 * `edit` may throw to refuse the change. Returns the new copy, or null when the
 * order is not in that restaurant's list.
 */
export function updateDemoOrder(
  merchantId: string,
  orderId: string,
  edit: (stored: Order) => Order
): Order | null {
  const orders = readDemoMerchantOrders(merchantId) ?? [];
  const stored = orders.find((o) => o.id === orderId);
  if (!stored) return null;
  const next = edit(stored);
  writeDemoMerchantOrders(
    merchantId,
    orders.map((o) => (o.id === orderId ? next : o))
  );
  return next;
}

/**
 * Calls `onChange` as soon as another browser tab writes a demo order list —
 * the web storage wrapper reads localStorage directly, so the next read sees
 * it. A no-op on native, where there is one process and polling suffices.
 */
export function subscribeDemoOrders(onChange: () => void): () => void {
  const target = globalThis as {
    addEventListener?: (type: string, fn: (e: { key: string | null; newValue: string | null }) => void) => void;
    removeEventListener?: (type: string, fn: (e: { key: string | null; newValue: string | null }) => void) => void;
  };
  if (typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') {
    return () => {};
  }
  const handler = (e: { key: string | null; newValue: string | null }) => {
    if (e.key && e.key.startsWith(DEMO_ORDERS_PREFIX)) onChange();
  };
  target.addEventListener('storage', handler);
  return () => target.removeEventListener?.('storage', handler);
}

/** The customer's own list of which orders are theirs, and where they live. */
const customerStore = createStorage({ id: 'azglobe.food.localOrders' });
const INDEX_KEY = 'index';

type IndexEntry = { id: string; merchantId: string; /** Progress on a timer — nobody operates it. */ auto?: boolean };

function demoIndex(): IndexEntry[] {
  const raw = customerStore.getString(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as IndexEntry[]) : [];
  } catch {
    return [];
  }
}

function writeDemoIndex(entries: IndexEntry[]): void {
  // Bounded like the Firebase list.
  customerStore.set(INDEX_KEY, JSON.stringify(entries.slice(0, MY_ORDERS_LIMIT)));
}

function demoMyOrders(): Order[] {
  return demoIndex()
    .map((e) => readLocalOrder(e.id))
    .filter((o): o is Order => o !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function readLocalOrder(id: string): Order | null {
  const entry = demoIndex().find((e) => e.id === id);
  if (entry) {
    const order = (readDemoMerchantOrders(entry.merchantId) ?? []).find((o) => o.id === id) ?? null;
    return order && entry.auto ? autoAdvance(entry.merchantId, order) : order;
  }
  // Orders placed before the shared store existed were kept under their id.
  const raw = customerStore.getString(id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Order;
  } catch {
    return null;
  }
}

/** Seconds after placing at which an unattended demo order reaches each step. */
const AUTO_STEPS: Array<{ status: OrderStatus; after: number }> = [
  { status: 'accepted', after: 20 },
  { status: 'preparing', after: 45 },
  { status: 'ready_for_pickup', after: 110 },
  { status: 'picked_up', after: 150 },
  { status: 'delivered', after: 240 },
];

/**
 * When an unattended order reaches `step`. A scheduled order is accepted
 * straight away but cooked for its slot: the later steps count back from the
 * slot, so it arrives when it was booked rather than minutes after ordering.
 */
function stepAt(order: Order, step: (typeof AUTO_STEPS)[number]): number {
  if (step.status !== 'accepted' && order.deliveryMode === 'scheduled' && order.scheduledFor) {
    const last = AUTO_STEPS[AUTO_STEPS.length - 1]!.after * 1000;
    return Math.max(order.createdAt, order.scheduledFor - last) + step.after * 1000;
  }
  return order.createdAt + step.after * 1000;
}

/** Moves an unattended order to wherever the clock says it should be, and stores it. */
function autoAdvance(merchantId: string, order: Order, now = Date.now()): Order {
  if (isTerminalStatus(order.status)) return order;
  const reached = new Set((order.timeline ?? []).map((t) => t.status));
  const due = AUTO_STEPS.filter((s) => !reached.has(s.status) && stepAt(order, s) <= now);
  if (!due.length) return order;
  return (
    updateDemoOrder(merchantId, order.id, (stored) => {
      if (isTerminalStatus(stored.status)) return stored;
      const have = new Set((stored.timeline ?? []).map((t) => t.status));
      const steps = AUTO_STEPS.filter((s) => !have.has(s.status) && stepAt(stored, s) <= now);
      if (!steps.length) return stored;
      return {
        ...stored,
        status: steps[steps.length - 1]!.status,
        timeline: [
          ...(stored.timeline ?? []),
          ...steps.map((s) => ({ status: s.status, at: stepAt(stored, s) })),
        ],
      };
    }) ?? order
  );
}

function withoutUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

async function placeDemoOrder(input: PlaceOrderInput): Promise<Order> {
  const merchantId = input.merchant.id;
  if (input.orderId) {
    const existing = readLocalOrder(input.orderId);
    if (existing) return existing;
  }
  // The business may have closed (or archived) it since the menu loaded.
  const operated = findDemoRestaurant(merchantId);
  const open = operated ? operated.isOpen === true && !operated.archived : input.merchant.isOpen !== false;
  if (!open) throw new RestaurantClosedError(operated?.name ?? input.merchant.name);

  const now = Date.now();
  const subtotal = input.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const pickup = input.orderType === 'pickup' || !input.address;
  const priorityFee = !pickup && input.deliveryMode === 'priority' ? PRIORITY_FEE : 0;
  const deliveryFee = pickup ? 0 : input.merchant.deliveryFee;
  const note = input.noteToRestaurant?.trim();
  const phone = input.userPhone?.trim() || DEMO_PHONE;

  const order: Order = withoutUndefined({
    id: input.orderId ?? newOrderId(),
    module: 'food',
    ref: newOrderRef(),
    userId: DEMO_CUSTOMER_ID,
    userName: input.userName,
    userPhone: phone,
    merchantId,
    merchantName: input.merchant.name,
    items: input.lines.map(({ lineId: _lineId, merchantName: _merchantName, ...rest }) => ({
      ...rest,
      lineTotal: rest.unitPrice * rest.qty,
    })),
    orderType: pickup ? 'pickup' : 'delivery',
    address: pickup || !input.address ? null : orderSnapshot(input.address),
    dropoffOption: input.address?.dropoffOption ?? 'door',
    ...(!pickup && input.deliveryDistanceKm != null
      ? { deliveryDistanceKm: Math.round(input.deliveryDistanceKm * 100) / 100 }
      : {}),
    requestUtensils: input.requestUtensils,
    noteToRestaurant: note || undefined,
    deliveryMode: input.deliveryMode,
    pricing: {
      subtotal,
      deliveryFee,
      priorityFee,
      promoDiscount: input.promoDiscount,
      total: Math.max(0, subtotal - input.promoDiscount) + deliveryFee + priorityFee,
      currency: 'LKR',
    },
    promoCode: input.promoCode,
    paymentMethod: input.paymentMethod,
    scheduledFor: input.scheduledFor,
    status: 'new',
    timeline: [{ status: 'new', at: now }],
    ...etaFor({ ...input, orderType: pickup ? 'pickup' : 'delivery' }, now),
    createdAt: now,
  } satisfies Order);

  writeDemoMerchantOrders(merchantId, [order, ...(readDemoMerchantOrders(merchantId) ?? [])]);
  writeDemoIndex([{ id: order.id, merchantId, ...(operated ? {} : { auto: true }) }, ...demoIndex()]);
  return order;
}
