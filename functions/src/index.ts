import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';

initializeApp();
const db = getFirestore();

const PRIORITY_FEE = 150;

type OrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/** Only these transitions are allowed; anything else is rejected. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['picked_up', 'cancelled'],
  picked_up: ['delivered'],
  delivered: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
};

type PlaceOrderRequest = {
  merchantId: string;
  items: Array<{ menuItemId: string; qty: number; selectedOptionIds: string[] }>;
  orderType: 'delivery' | 'pickup';
  deliveryMode: 'priority' | 'standard' | 'scheduled';
  requestUtensils: boolean;
  noteToRestaurant?: string;
  promoCode?: string;
  clientTotal: number;
};

/**
 * Create an order.
 *
 * Every price is recomputed here from the merchant and menu documents. The
 * client's total is accepted only as a value to compare against — a mismatch is
 * logged and the server's figure wins, so a tampered client cannot change what
 * is charged.
 */
export const placeOrder = onCall<PlaceOrderRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to place an order.');

  const input = request.data;
  if (!input?.merchantId || !input.items?.length) {
    throw new HttpsError('invalid-argument', 'An order needs a merchant and at least one item.');
  }

  const merchantRef = db.collection('merchants').doc(input.merchantId);
  const merchantSnap = await merchantRef.get();
  if (!merchantSnap.exists) throw new HttpsError('not-found', 'That restaurant no longer exists.');

  const merchant = merchantSnap.data()!;
  if (merchant.isOpen === false) {
    throw new HttpsError('failed-precondition', `${merchant.name} is closed right now.`);
  }

  // ── Recompute the line items from the source menu documents ──────────────
  const itemRefs = input.items.map((i) => merchantRef.collection('menuItems').doc(i.menuItemId));
  const itemSnaps = await db.getAll(...itemRefs);

  let subtotal = 0;
  const items = input.items.map((requested, index) => {
    const snap = itemSnaps[index]!;
    if (!snap.exists) throw new HttpsError('not-found', 'A dish in your cart is no longer available.');

    const menuItem = snap.data()!;
    if (menuItem.available === false) {
      throw new HttpsError('failed-precondition', `${menuItem.name} is sold out.`);
    }

    const qty = Math.max(1, Math.min(99, Math.floor(requested.qty)));

    // Resolve each chosen option against the menu item's own groups, so a
    // client cannot invent a discount by sending an unknown option id.
    const chosen = (menuItem.optionGroups ?? []).flatMap(
      (group: { key: string; label: string; choices: Array<{ id: string; label: string; priceDelta: number }> }) =>
        group.choices
          .filter((choice) => requested.selectedOptionIds.includes(choice.id))
          .map((choice) => ({
            groupKey: group.key,
            groupLabel: group.label,
            choiceId: choice.id,
            label: choice.label,
            priceDelta: Number(choice.priceDelta) || 0,
          }))
    );

    const unitPrice = chosen.reduce(
      (sum: number, o: { priceDelta: number }) => sum + o.priceDelta,
      Number(menuItem.price) || 0
    );
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    return {
      menuItemId: snap.id,
      merchantId: input.merchantId,
      name: menuItem.name,
      image: menuItem.image,
      qty,
      unitPrice,
      selectedOptions: chosen,
      lineTotal,
    };
  });

  // ── Fees and promotions ──────────────────────────────────────────────────
  const deliveryFee =
    input.orderType === 'pickup'
      ? 0
      : merchant.freeDeliveryOver && subtotal >= merchant.freeDeliveryOver
        ? 0
        : Number(merchant.deliveryFee) || 0;

  const priorityFee = input.deliveryMode === 'priority' ? PRIORITY_FEE : 0;
  const promoDiscount = await resolvePromo(input.promoCode, input.merchantId, subtotal);
  const total = Math.max(0, subtotal - promoDiscount) + deliveryFee + priorityFee;

  if (Math.abs(total - input.clientTotal) > 0.5) {
    // Not fatal — the server figure is authoritative — but worth investigating.
    logger.warn('Order total mismatch', {
      uid,
      merchantId: input.merchantId,
      clientTotal: input.clientTotal,
      serverTotal: total,
    });
  }

  const now = Timestamp.now();
  const prepMin = Number(merchant.prepTimeMin) || 20;
  const prepMax = Number(merchant.prepTimeMax) || 40;

  const orderRef = db.collection('orders').doc();
  const order = {
    module: 'food' as const,
    ref: `AZG-${orderRef.id.slice(0, 4).toUpperCase()}`,
    userId: uid,
    merchantId: input.merchantId,
    merchantName: merchant.name,
    items,
    orderType: input.orderType,
    requestUtensils: Boolean(input.requestUtensils),
    noteToRestaurant: input.noteToRestaurant ?? null,
    deliveryMode: input.deliveryMode,
    pricing: { subtotal, deliveryFee, priorityFee, promoDiscount, total, currency: 'LKR' as const },
    promoCode: input.promoCode ?? null,
    status: 'new' as OrderStatus,
    timeline: [{ status: 'new', at: now }],
    etaFrom: Timestamp.fromMillis(now.toMillis() + prepMin * 60_000),
    etaTo: Timestamp.fromMillis(now.toMillis() + prepMax * 60_000),
    createdAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(orderRef, order);
    tx.set(db.collection('customers').doc(uid), { activeOrderId: orderRef.id }, { merge: true });
    if (input.promoCode) {
      tx.update(db.collection('promotions').doc(input.promoCode.toUpperCase()), {
        usedCount: FieldValue.increment(1),
      });
    }
  });

  return { id: orderRef.id, ...order };
});

async function resolvePromo(
  code: string | undefined,
  merchantId: string,
  subtotal: number
): Promise<number> {
  if (!code) return 0;

  const snap = await db.collection('promotions').doc(code.toUpperCase()).get();
  if (!snap.exists) throw new HttpsError('not-found', 'That promo code is not valid.');

  const promo = snap.data()!;
  if (promo.merchantId && promo.merchantId !== merchantId) {
    throw new HttpsError('failed-precondition', 'That code does not apply to this restaurant.');
  }
  if (promo.validUntil && promo.validUntil.toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'That promo code has expired.');
  }
  if (promo.minOrder && subtotal < promo.minOrder) {
    throw new HttpsError('failed-precondition', `Spend Rs. ${promo.minOrder} to use this code.`);
  }

  return promo.type === 'percent'
    ? Math.round((subtotal * Number(promo.value)) / 100)
    : Number(promo.value);
}

/** Validate a promo without placing an order — used by the cart screen. */
export const applyPromoCode = onCall<{ code: string; merchantId: string; subtotal: number }>(
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const { code, merchantId, subtotal } = request.data;
    const discount = await resolvePromo(code, merchantId, subtotal);
    return { code: code.toUpperCase(), discount };
  }
);

/**
 * Advance an order's status. Only the owning merchant may move an order
 * forward, and only along `ALLOWED_TRANSITIONS`.
 */
export const updateOrderStatus = onCall<{ orderId: string; status: OrderStatus }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const { orderId, status } = request.data;
  const orderRef = db.collection('orders').doc(orderId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found.');

    const order = snap.data()!;
    const merchantSnap = await tx.get(db.collection('merchants').doc(order.merchantId));
    if (merchantSnap.data()?.supplierId !== uid) {
      throw new HttpsError('permission-denied', 'Only the restaurant can update this order.');
    }

    const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? [];
    if (!allowed.includes(status)) {
      throw new HttpsError('failed-precondition', `Cannot go from ${order.status} to ${status}.`);
    }

    tx.update(orderRef, {
      status,
      timeline: FieldValue.arrayUnion({ status, at: Timestamp.now() }),
    });
  });

  return { ok: true };
});

/**
 * Push a notification when an order's status changes, and clear the user's
 * active-order pointer once it reaches a terminal state — that pointer is what
 * makes the Home screen's live card a single cheap read.
 */
export const onOrderWrite = onDocumentWritten('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || before?.status === after.status) return;

  const status = after.status as OrderStatus;

  if (status === 'delivered' || status === 'cancelled') {
    await db.collection('customers').doc(after.userId).set({ activeOrderId: null }, { merge: true });
  }

  const body =
    after.orderType === 'pickup' ? PICKUP_NOTIFICATION_COPY[status] ?? NOTIFICATION_COPY[status] : NOTIFICATION_COPY[status];
  if (!body) return;

  const userSnap = await db.collection('customers').doc(after.userId).get();
  const token = userSnap.data()?.fcmToken;
  if (!token) return;

  await getMessaging().send({
    token,
    notification: { title: after.merchantName, body },
    data: { orderId: event.params.orderId, status },
  });
});

const NOTIFICATION_COPY: Partial<Record<OrderStatus, string>> = {
  accepted: 'Your order has been accepted.',
  preparing: 'Your order is being prepared.',
  ready_for_pickup: 'Your order is ready and waiting for a driver.',
  picked_up: 'Your driver is on the way.',
  delivered: 'Your order has been delivered. Enjoy!',
  cancelled: 'Your order was cancelled.',
};

/** Takeaway has no driver. A collected order goes picked_up → delivered at once, so only one of those notifies. */
const PICKUP_NOTIFICATION_COPY: Partial<Record<OrderStatus, string>> = {
  ready_for_pickup: 'Your order is ready to collect.',
  picked_up: '',
  delivered: 'Order collected. Enjoy!',
};

/** Keep a merchant's rating and review count in step with its reviews. */
export const onReviewWrite = onDocumentWritten(
  'merchants/{merchantId}/reviews/{reviewId}',
  async (event) => {
    const merchantRef = db.collection('merchants').doc(event.params.merchantId);
    const reviews = await merchantRef.collection('reviews').get();

    if (reviews.empty) {
      await merchantRef.update({ rating: 0, reviewCount: 0 });
      return;
    }

    const sum = reviews.docs.reduce((acc, d) => acc + (Number(d.data().rating) || 0), 0);
    await merchantRef.update({
      rating: Math.round((sum / reviews.size) * 10) / 10,
      reviewCount: reviews.size,
    });
  }
);
