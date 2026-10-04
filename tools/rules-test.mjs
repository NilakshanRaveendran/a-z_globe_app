#!/usr/bin/env node
/**
 * Security-rules tests, run against the Firestore emulator.
 *
 *   npm run test:rules          (starts and stops the emulator itself)
 *
 * These rules are not a formality. The project is on the Spark plan, so there
 * is no Cloud Function between the client and the database — `firestore.rules`
 * IS the server-side enforcement for who may read an order, what a new order
 * may claim, how an order may move through its lifecycle, and — since the
 * account split — which of the two account kinds may do any of it. Anything
 * the rules get wrong is exploitable from a modified client, so every branch
 * that matters is asserted here.
 *
 * The emulator's REST API is driven directly rather than through
 * `@firebase/rules-unit-testing`, which needs the compat SDK and fails to
 * register it in a hoisted npm workspace (duplicate `@firebase/app-compat`
 * instances, so `app.firestore()` is never defined). REST has no such problem
 * and exercises exactly the same rules.
 *
 * Everything here is local and free; nothing touches the real project.
 */
import { readFileSync } from 'node:fs';

const PROJECT = 'azglobe-rules-test';
// Read the port from firebase.json so the test and the emulator cannot drift.
const PORT = JSON.parse(readFileSync('firebase.json', 'utf8')).emulators.firestore.port;
const BASE = `http://127.0.0.1:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents`;

// Two kinds of account, deliberately never the same uid. CUSTOMER and OTHER
// are people; SUPPLIER and RIVAL are businesses. NEW_PERSON / NEW_BUSINESS are
// unclaimed uids used to test first-time profile creation.
const CUSTOMER = 'customer-uid';
const OTHER = 'other-customer-uid';
const SUPPLIER = 'supplier-uid';
const RIVAL = 'rival-supplier-uid';
const NEW_PERSON = 'new-person-uid';
const NEW_BUSINESS = 'new-business-uid';

// The sign-in number each account's token carries — what the messaging
// directory is keyed on. Accounts not listed have no phone number.
const PHONES = { [CUSTOMER]: '+94770000001', [OTHER]: '+94770000002' };

// ── Emulator auth ──────────────────────────────────────────────────────────
// The emulator does not verify signatures, so an unsigned JWT is enough to
// present a given uid. `owner` is the emulator's bypass token, used for setup.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function tokenFor(uid) {
  if (uid === null) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: uid,
    user_id: uid,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    firebase: { sign_in_provider: 'custom', identities: {} },
    ...(PHONES[uid] ? { phone_number: PHONES[uid] } : {}),
  };
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
}

// ── Firestore REST value encoding ──────────────────────────────────────────
function encode(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: fields(v) } };
  throw new Error(`cannot encode ${typeof v}`);
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encode(v)]));

async function request(method, path, { as = null, body, updateMask, rawBody } = {}) {
  const token = tokenFor(as);
  const qs = updateMask
    ? '?' + updateMask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
    : '';
  // `:runQuery` hangs off the documents root, not a document path.
  const url = path.startsWith(':') ? `${BASE}${path}` : `${BASE}/${path}${qs}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(rawBody ? { body: JSON.stringify(rawBody) } : body ? { body: JSON.stringify({ fields: fields(body) }) } : {}),
  });
  return res;
}

/** Writes performed as the emulator owner, bypassing rules — test setup only. */
async function seedDoc(path, data) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: fields(data) }),
  });
  if (!res.ok) throw new Error(`seed ${path} failed: ${res.status} ${await res.text()}`);
}

const set = (path, data, as) => request('PATCH', path, { as, body: data });
const update = (path, data, as) =>
  request('PATCH', path, { as, body: data, updateMask: Object.keys(data) });
const read = (path, as) => request('GET', path, { as });
const remove = (path, as) => request('DELETE', path, { as });
const list = (path, as) => request('GET', path, { as });

// ── Tiny test harness ──────────────────────────────────────────────────────
const results = [];
let failures = 0;

async function allow(name, run) {
  const res = await run();
  if (res.ok) results.push(`  PASS  ${name}`);
  else {
    failures++;
    results.push(`  FAIL  ${name}\n          expected allow, got ${res.status}`);
  }
}

async function deny(name, run) {
  const res = await run();
  if (res.status === 403) results.push(`  PASS  ${name}`);
  else {
    failures++;
    results.push(`  FAIL  ${name}\n          expected deny, got ${res.status}`);
  }
}

function section(title) {
  results.push(`\n${title}`);
}

// ── Fixtures ───────────────────────────────────────────────────────────────
function orderBody(over = {}) {
  return {
    module: 'food',
    ref: 'AZG-0001',
    userId: CUSTOMER,
    // Denormalised so the restaurant can address the customer — it cannot read
    // customers/{uid}. See Order.userName.
    userName: 'Vanan',
    merchantId: 'open-shop',
    merchantName: 'Open Shop',
    items: [{ menuItemId: 'a', qty: 1, unitPrice: 420, lineTotal: 420 }],
    orderType: 'delivery',
    deliveryMode: 'standard',
    requestUtensils: false,
    pricing: { subtotal: 420, deliveryFee: 80, priorityFee: 0, promoDiscount: 0, total: 500, currency: 'LKR' },
    status: 'new',
    timeline: [{ status: 'new', at: 1 }],
    etaFrom: 1,
    etaTo: 2,
    ...over,
  };
}
const price = (over) => ({
  pricing: { subtotal: 420, deliveryFee: 80, priorityFee: 0, promoDiscount: 0, total: 500, currency: 'LKR', ...over },
});
const givenOrder = (id, over = {}) => seedDoc(`orders/${id}`, orderBody(over));
const advance = (id, to, timeline, as) => update(`orders/${id}`, { status: to, timeline }, as);

const merchant = (over) => ({
  module: 'food', name: 'Shop', supplierId: SUPPLIER, isOpen: true, deliveryFee: 80, ...over,
});

await seedDoc(`customers/${CUSTOMER}`, { name: 'Vanan' });
await seedDoc(`customers/${OTHER}`, { name: 'Someone Else' });
await seedDoc(`suppliers/${SUPPLIER}`, { name: "Mama's Kitchen (Pvt) Ltd" });
await seedDoc(`suppliers/${RIVAL}`, { name: 'Rival Foods' });

await seedDoc('merchants/open-shop', merchant({ name: 'Open Shop' }));
await seedDoc('merchants/closed-shop', merchant({ name: 'Closed Shop', isOpen: false }));
// A merchant whose ownership field wrongly holds a CUSTOMER uid. Nothing
// should ever write this, but if something did, that customer must still gain
// no supplier powers — see `ownsMerchant()`.
await seedDoc('merchants/mis-seeded-shop', merchant({ name: 'Mis-seeded', supplierId: CUSTOMER }));

// ── Account separation ─────────────────────────────────────────────────────
section('account separation');
await allow('an unclaimed uid may become a customer', () =>
  set(`customers/${NEW_PERSON}`, { name: 'New Person' }, NEW_PERSON));
await allow('an unclaimed uid may become a supplier', () =>
  set(`suppliers/${NEW_BUSINESS}`, { name: 'New Business' }, NEW_BUSINESS));
await deny('a customer uid may NOT also become a supplier', () =>
  set(`suppliers/${CUSTOMER}`, { name: 'Sneaky Restaurant' }, CUSTOMER));
await deny('a supplier uid may NOT also become a customer', () =>
  set(`customers/${SUPPLIER}`, { name: 'Sneaky Person' }, SUPPLIER));
await deny('a supplier may NOT place an order', () =>
  set('orders/s1', orderBody({ userId: SUPPLIER }), SUPPLIER));
await deny('a customer may NOT manage a merchant, even one naming their uid', () =>
  update('merchants/mis-seeded-shop', { name: 'Hijacked' }, CUSTOMER));
await deny('a customer may NOT read a supplier profile', () =>
  read(`suppliers/${SUPPLIER}`, CUSTOMER));

// ── Account links ──────────────────────────────────────────────────────────
section('account links');
const LINK = `${CUSTOMER}_${SUPPLIER}`;
await allow('a customer may propose a link to a supplier account', () =>
  set(`accountLinks/${LINK}`, {
    customerUid: CUSTOMER, supplierUid: SUPPLIER, confirmedBy: [CUSTOMER], status: 'pending',
  }, CUSTOMER));
await deny('nobody may propose a link on another account’s behalf', () =>
  set(`accountLinks/${OTHER}_${SUPPLIER}`, {
    customerUid: OTHER, supplierUid: SUPPLIER, confirmedBy: [CUSTOMER], status: 'pending',
  }, CUSTOMER));
await allow('the supplier side confirms the link', () =>
  update(`accountLinks/${LINK}`, { confirmedBy: [CUSTOMER, SUPPLIER], status: 'confirmed' }, SUPPLIER));
await deny('an unrelated account may not read the link', () => read(`accountLinks/${LINK}`, OTHER));
// The point of the whole design: a confirmed link is a statement about people,
// not a grant of permission.
await deny('a confirmed link grants the customer NO merchant permission', () =>
  update('merchants/open-shop', { name: 'Hijacked via link' }, CUSTOMER));
await deny('a confirmed link grants the supplier NO access to customer orders', () =>
  read(`customers/${CUSTOMER}`, SUPPLIER));

// ── Catalogue ──────────────────────────────────────────────────────────────
section('catalogue');
await allow('anyone may read the merchant catalogue', () => list('merchants', null));
await deny('a client may not write a merchant it does not own', () =>
  set('merchants/open-shop', { name: 'Hacked' }, CUSTOMER));
await allow('the owning supplier may write its merchant', () =>
  update('merchants/open-shop', { name: 'Renamed' }, SUPPLIER));
await allow('a supplier may create its own business', () =>
  set('merchants/new-shop', merchant({ name: 'Brand New' }), SUPPLIER));
await deny('a supplier may not create a business owned by another supplier', () =>
  set('merchants/hijacked-shop', merchant({ name: 'Not Mine', supplierId: RIVAL }), SUPPLIER));
await deny('a supplier may not invent its own rating', () =>
  set('merchants/rated-shop', merchant({ name: 'Five Stars', rating: 5, reviewCount: 999 }), SUPPLIER));
// A new restaurant MUST be able to carry rating 0: the customer catalogue query
// orders by `rating`, and Firestore omits documents lacking the ordered field,
// so refusing zero would make every new restaurant invisible to customers.
await allow('a supplier may create a business rated 0', () =>
  set('merchants/fresh-shop', merchant({ name: 'Fresh', rating: 0, reviewCount: 0 }), SUPPLIER));

// The EXACT document `createRestaurant()` writes from the Add Restaurant sheet.
// Kept in step with apps/azglobe/src/supplier/services/restaurants.ts: the whole
// catalogue now comes through that one call, so if the rules ever stop
// accepting its shape, no supplier can open a restaurant at all.
await allow('the Add Restaurant payload is accepted as written by the app', () =>
  set(
    'merchants/mamas-kitchen-a1b2c',
    {
      module: 'food',
      supplierId: SUPPLIER,
      name: "Mama's Kitchen",
      tagline: 'Sri Lankan home cooking',
      cuisines: ['Sri Lankan', 'Authentic'],
      rating: 0,
      reviewCount: 0,
      deliveryFee: 150,
      prepTimeMin: 20,
      prepTimeMax: 30,
      address: '42, Main Street, Trincomalee',
      phone: '+94 26 222 3456',
      hours: {
        mon: { open: '7:00 AM', close: '10:00 PM' },
        tue: { open: '7:00 AM', close: '10:00 PM' },
        wed: { open: '7:00 AM', close: '10:00 PM' },
        thu: { open: '7:00 AM', close: '10:00 PM' },
        fri: { open: '7:00 AM', close: '10:00 PM' },
        sat: { open: '7:00 AM', close: '10:00 PM' },
        sun: { open: '7:00 AM', close: '10:00 PM', closed: true },
      },
      isOpen: false,
      features: ['takeaway', 'homeDelivery'],
      coverImage: '',
      badges: [],
    },
    SUPPLIER
  ));
await deny('a CUSTOMER may not create a restaurant with that same payload', () =>
  set('merchants/customer-owned', merchant({ name: 'Nope', supplierId: CUSTOMER, rating: 0 }), CUSTOMER));
await deny('a supplier may not edit its rating afterwards', () =>
  update('merchants/open-shop', { rating: 5 }, SUPPLIER));
await deny('a supplier may not reassign ownership of its business', () =>
  update('merchants/open-shop', { supplierId: RIVAL }, SUPPLIER));
// The Restaurant Info edit payload, including the map pin set from the device.
// `geo.geohash` is what the "near you" range query sorts on, so a rule that
// refused it would silently keep every restaurant out of those results.
await allow('the Restaurant Info edit payload is accepted', () =>
  update(
    'merchants/fresh-shop',
    {
      name: 'Fresh',
      tagline: 'Home-style cooking',
      cuisines: ['Sri Lankan'],
      address: '42, Main Street, Trincomalee',
      phone: '026 222 3456',
      deliveryFee: 150,
      prepTimeMin: 20,
      prepTimeMax: 30,
      geo: { lat: 8.5874, lng: 81.2152, geohash: 'tdvhbh1' },
    },
    SUPPLIER
  ));
await allow('the owning supplier may write its menu', () =>
  set('merchants/open-shop/menuItems/m1', { name: 'Kottu', price: 420 }, SUPPLIER));
await deny('another supplier may not write that menu', () =>
  set('merchants/open-shop/menuItems/m2', { name: 'Sabotage', price: 1 }, RIVAL));

// ── Placing an order ───────────────────────────────────────────────────────
section('placing an order');
await allow('a signed-in customer may place a valid order', () =>
  set('orders/o1', orderBody(), CUSTOMER));
await deny('an anonymous visitor may not place an order', () =>
  set('orders/o2', orderBody(), null));
await deny("an order may not be placed in another user's name", () =>
  set('orders/o3', orderBody({ userId: OTHER }), CUSTOMER));
await deny('an order may not carry a date the client chose', () =>
  set('orders/o3b', orderBody({ createdAt: Date.now() + 86_400_000 * 365 }), CUSTOMER));
await deny('an order may not start at a status other than new', () =>
  set('orders/o4', orderBody({ status: 'delivered', timeline: [{ status: 'delivered', at: 1 }] }), CUSTOMER));
await deny("the delivery fee may not undercut the merchant's own fee", () =>
  set('orders/o5', orderBody(price({ deliveryFee: 5, total: 425 })), CUSTOMER));
await deny('the total must equal subtotal - promo + fees', () =>
  set('orders/o6', orderBody(price({ total: 1 })), CUSTOMER));
await deny('a promo may not exceed the subtotal', () =>
  set('orders/o7', orderBody(price({ promoDiscount: 999, total: 80 })), CUSTOMER));
await deny('an order may not be placed with a closed restaurant', () =>
  set('orders/o8', orderBody({ merchantId: 'closed-shop', merchantName: 'Closed Shop' }), CUSTOMER));
// The fields `placeOrder()` snapshots on top: the customer's phone (so the
// restaurant can call), the longer ref, the payment label, explicit nulls.
await allow('an order may carry the customer phone, ref and payment snapshot', () =>
  set('orders/o9', orderBody({
    userPhone: '+94711109390', ref: 'AZG-7K3Q9P', paymentMethod: 'Cash on delivery',
    noteToRestaurant: null, promoCode: null,
  }), CUSTOMER));

// ── Delivery terms: free zone, per km, radius ──────────────────────────────
section('delivery terms');
// Pinned in Trincomalee; free within 1 km, then Rs. 50 per started km, up to
// 5 km; orders of Rs. 2,000+ deliver free (inside the radius only).
const SHOP_PIN = { lat: 8.5874, lng: 81.2152, geohash: 'tc9bb57' };
const kmNorth = (km) => ({ lat: SHOP_PIN.lat + km / 111.19493, lng: SHOP_PIN.lng });
await seedDoc('merchants/zone-shop', merchant({
  name: 'Zone Shop', deliveryFee: 0, freeDeliveryOver: 2000, geo: SHOP_PIN,
  deliveryRules: { pricing: 'distance', freeKm: 1, perKm: 50, maxKm: 5 },
}));
await seedDoc('merchants/radius-shop', merchant({
  name: 'Radius Shop', deliveryFee: 120, geo: SHOP_PIN,
  deliveryRules: { pricing: 'flat', freeKm: 0, perKm: 0, maxKm: 3 },
}));
const zoneOrder = (km, fee, subtotal = 420, over = {}) => orderBody({
  merchantId: 'zone-shop', merchantName: 'Zone Shop',
  address: km === null ? { line1: 'No pin', city: 'Trinco' } : { line1: 'Pinned', city: 'Trinco', geo: kmNorth(km) },
  pricing: { subtotal, deliveryFee: fee, priorityFee: 0, promoDiscount: 0, total: subtotal + fee, currency: 'LKR' },
  ...over,
});
await allow('inside the free zone delivery costs nothing', () =>
  set('orders/z1', zoneOrder(0.6, 0), CUSTOMER));
await allow('past the free zone: Rs. 50 per started km (3.4 km → Rs. 150)', () =>
  set('orders/z2', zoneOrder(3.4, 150), CUSTOMER));
await deny('past the free zone the fee may not be dropped', () =>
  set('orders/z3', zoneOrder(3.4, 0), CUSTOMER));
await deny('past the free zone the fee may not be undercut (3.4 km at Rs. 100)', () =>
  set('orders/z4', zoneOrder(3.4, 100), CUSTOMER));
await deny('beyond the 5 km radius the restaurant does not deliver', () =>
  set('orders/z5', zoneOrder(6, 300), CUSTOMER));
await deny('an address without a pin cannot be priced, so is refused', () =>
  set('orders/z6', zoneOrder(null, 0), CUSTOMER));
await allow('a Rs. 2,000+ order delivers free inside the radius', () =>
  set('orders/z7', zoneOrder(4.5, 0, 2400), CUSTOMER));
await deny('a big order does not extend the radius', () =>
  set('orders/z8', zoneOrder(7, 0, 2400), CUSTOMER));
await allow('takeaway ignores the radius and the fee', () =>
  set('orders/z9', zoneOrder(null, 0, 420, { orderType: 'pickup', address: null }), CUSTOMER));
await allow('a flat-fee restaurant with a radius: its fee, inside it', () =>
  set('orders/z10', orderBody({
    merchantId: 'radius-shop', merchantName: 'Radius Shop', address: { line1: 'x', city: 'y', geo: kmNorth(2.5) },
    pricing: { subtotal: 420, deliveryFee: 120, priorityFee: 0, promoDiscount: 0, total: 540, currency: 'LKR' },
  }), CUSTOMER));
await deny('a flat-fee restaurant with a radius: nothing outside it', () =>
  set('orders/z11', orderBody({
    merchantId: 'radius-shop', merchantName: 'Radius Shop', address: { line1: 'x', city: 'y', geo: kmNorth(3.5) },
    pricing: { subtotal: 420, deliveryFee: 120, priorityFee: 0, promoDiscount: 0, total: 540, currency: 'LKR' },
  }), CUSTOMER));
await deny('a flat fee may not be dropped below the threshold', () =>
  set('orders/z12', orderBody(price({ deliveryFee: 0, total: 420 })), CUSTOMER));
await allow('the owner may set delivery terms', () =>
  update('merchants/open-shop', { deliveryRules: { pricing: 'distance', freeKm: 1, perKm: 40, maxKm: 6 } }, SUPPLIER));
await deny('delivery terms may not be malformed (negative per km)', () =>
  update('merchants/open-shop', { deliveryRules: { pricing: 'distance', freeKm: 1, perKm: -5, maxKm: 6 } }, SUPPLIER));
await deny('a free zone may not reach past the radius', () =>
  update('merchants/open-shop', { deliveryRules: { pricing: 'distance', freeKm: 8, perKm: 40, maxKm: 6 } }, SUPPLIER));
await allow('the owner may clear its delivery terms', () =>
  update('merchants/open-shop', { deliveryRules: null }, SUPPLIER));

// ── Promotions ─────────────────────────────────────────────────────────────
section('promotions');
const FAR_FUTURE = Date.now() + 365 * 24 * 3600 * 1000;
await seedDoc('promotions/TEN', { code: 'TEN', type: 'percent', value: 10, merchantId: 'open-shop', validUntil: FAR_FUTURE });
await seedDoc('promotions/OLD', { code: 'OLD', type: 'percent', value: 10, validUntil: 1 });
await seedDoc('promotions/ELSEWHERE', { code: 'ELSEWHERE', type: 'percent', value: 10, merchantId: 'closed-shop', validUntil: FAR_FUTURE });
await seedDoc('promotions/FIFTY', { code: 'FIFTY', type: 'fixed', value: 50, validUntil: FAR_FUTURE });
// 10% of 420 = 42; total = 420 - 42 + 80 = 458.
await allow('a discount backed by a real promotion is accepted', () =>
  set('orders/p1', orderBody({ promoCode: 'TEN', ...price({ promoDiscount: 42, total: 458 }) }), CUSTOMER));
await deny('a discount with no promotion behind it is refused', () =>
  set('orders/p2', orderBody({ promoCode: 'MAMA20', ...price({ promoDiscount: 84, total: 416 }) }), CUSTOMER));
await deny('a discount with no code at all is refused', () =>
  set('orders/p3', orderBody(price({ promoDiscount: 42, total: 458 })), CUSTOMER));
await deny('a percent discount larger than the promotion allows is refused', () =>
  set('orders/p4', orderBody({ promoCode: 'TEN', ...price({ promoDiscount: 200, total: 300 }) }), CUSTOMER));
await deny('an expired promotion is refused', () =>
  set('orders/p5', orderBody({ promoCode: 'OLD', ...price({ promoDiscount: 42, total: 458 }) }), CUSTOMER));
await deny("another restaurant's promotion is refused", () =>
  set('orders/p6', orderBody({ promoCode: 'ELSEWHERE', ...price({ promoDiscount: 42, total: 458 }) }), CUSTOMER));
await allow('a fixed promotion up to its value is accepted', () =>
  set('orders/p7', orderBody({ promoCode: 'FIFTY', ...price({ promoDiscount: 50, total: 450 }) }), CUSTOMER));
await deny('a fixed promotion above its value is refused', () =>
  set('orders/p8', orderBody({ promoCode: 'FIFTY', ...price({ promoDiscount: 60, total: 440 }) }), CUSTOMER));

// ── Restaurant offers ──────────────────────────────────────────────────────
section('restaurant offers');
const offer = (over = {}) => ({
  merchantId: 'open-shop',
  type: 'percent',
  value: 20,
  appliesTo: 'all',
  validUntil: FAR_FUTURE,
  active: true,
  usedCount: 0,
  look: { label: 'LIMITED TIME OFFER', background: 'sunset', illustration: 'burger' },
  ...over,
});
await allow('the owner may create an offer for their restaurant', () =>
  set('promotions/off1', offer(), SUPPLIER));
await deny("a supplier may not create an offer for another restaurant", () =>
  set('promotions/off2', offer(), RIVAL));
await deny('a customer may not create an offer', () => set('promotions/off3', offer(), CUSTOMER));
await deny('an offer may not carry a promo code', () =>
  set('promotions/off4', offer({ code: 'FREE' }), SUPPLIER));
await deny('an offer may not start with uses already counted', () =>
  set('promotions/off5', offer({ usedCount: 7 }), SUPPLIER));
await deny('a percent offer may not exceed 100%', () =>
  set('promotions/off6', offer({ value: 150 }), SUPPLIER));
await allow('the owner may switch an offer off', () =>
  set('promotions/off1', offer({ active: false }), SUPPLIER));
await deny('an offer may not be moved to another restaurant', () =>
  set('promotions/off1', offer({ merchantId: 'closed-shop' }), SUPPLIER));
await deny("a rival may not edit someone else's offer", () =>
  set('promotions/off1', offer({ value: 90 }), RIVAL));
// 20% of 420 = 84; total = 420 - 84 + 80 = 416.
await deny('a switched-off offer discounts nothing', () =>
  set('orders/q1', orderBody({ promoCode: 'off1', ...price({ promoDiscount: 84, total: 416 }) }), CUSTOMER));
await seedDoc('promotions/live', offer());
await allow('a running offer discounts the order', () =>
  set('orders/q2', orderBody({ promoCode: 'live', ...price({ promoDiscount: 84, total: 416 }) }), CUSTOMER));
await seedDoc('promotions/claimed', offer({ usageLimit: 3, usedCount: 3 }));
await deny('a fully claimed offer discounts nothing', () =>
  set('orders/q3', orderBody({ promoCode: 'claimed', ...price({ promoDiscount: 84, total: 416 }) }), CUSTOMER));
// Offers saved before the editor learned to omit unset numbers carry explicit
// nulls. Null means "no minimum" / "no limit", so such an offer must still
// discount — before `promoTermsHold` was null-safe it failed every order.
await seedDoc('promotions/nulls', offer({ minOrder: null, usageLimit: null }));
await allow('an offer stored with minOrder/usageLimit null still discounts', () =>
  set('orders/q4', orderBody({ promoCode: 'nulls', ...price({ promoDiscount: 84, total: 416 }) }), CUSTOMER));
await seedDoc('promotions/big-min', offer({ minOrder: 1000 }));
await deny('an order below the offer minimum is refused', () =>
  set('orders/q5', orderBody({ promoCode: 'big-min', ...price({ promoDiscount: 84, total: 416 }) }), CUSTOMER));
await allow('the owner may count a use when accepting', () =>
  set('promotions/live', offer({ usedCount: 1 }), SUPPLIER));
await allow('the owner may delete an offer', () => remove('promotions/live', SUPPLIER));

// ── Delivery addresses ─────────────────────────────────────────────────────
section('delivery addresses');
const ADDR = { label: 'Home', line1: '574 Hospital Rd', city: 'Jaffna', buildingType: 'house', dropoffOption: 'door' };
await allow('a customer may save an address to their own book', () =>
  set(`customers/${CUSTOMER}/addresses/a1`, ADDR, CUSTOMER));
await deny("a customer may not read another customer's addresses", () =>
  read(`customers/${CUSTOMER}/addresses/a1`, OTHER));
await deny("a supplier may not read a customer's address book", () =>
  read(`customers/${CUSTOMER}/addresses/a1`, SUPPLIER));
await allow('an order may carry its delivery address snapshot', () =>
  set('orders/addr1', orderBody({ address: { id: 'a1', ...ADDR } }), CUSTOMER));
await allow('the fulfilling supplier can read that address on the order', () =>
  read('orders/addr1', SUPPLIER));

// ── Reading an order ───────────────────────────────────────────────────────
section('reading an order');
await allow('the customer may read their own order', () => read('orders/o1', CUSTOMER));
await allow('the fulfilling supplier may read the order', () => read('orders/o1', SUPPLIER));
await deny("an unrelated customer may not read someone else's order", () => read('orders/o1', OTHER));
await deny("an unrelated supplier may not read another restaurant's order", () =>
  read('orders/o1', RIVAL));

// ── Advancing an order ─────────────────────────────────────────────────────
section('advancing an order');
const t = [{ status: 'new', at: 1 }];
await givenOrder('t1');
await allow('the supplier may advance new -> accepted', () =>
  advance('t1', 'accepted', [...t, { status: 'accepted', at: 2 }], SUPPLIER));

await givenOrder('t2');
await deny('the supplier may NOT skip new -> delivered', () =>
  advance('t2', 'delivered', [...t, { status: 'delivered', at: 2 }], SUPPLIER));

await givenOrder('t3', { status: 'delivered', timeline: [{ status: 'delivered', at: 1 }] });
await deny('the supplier may NOT move an order backwards', () =>
  advance('t3', 'preparing', [{ status: 'delivered', at: 1 }, { status: 'preparing', at: 2 }], SUPPLIER));

await givenOrder('t4');
await deny('an invented status is rejected', () =>
  advance('t4', 'free-food', [...t, { status: 'free-food', at: 2 }], SUPPLIER));

await givenOrder('t5');
await deny('the timeline entry must match the new status', () =>
  advance('t5', 'accepted', [...t, { status: 'cancelled', at: 2 }], SUPPLIER));

await givenOrder('t6');
await deny('advancing without recording it in the timeline is rejected', () =>
  update('orders/t6', { status: 'accepted' }, SUPPLIER));

await givenOrder('t7');
await deny('the customer may not advance their own order', () =>
  advance('t7', 'accepted', [...t, { status: 'accepted', at: 2 }], CUSTOMER));

await givenOrder('t8');
await deny("a supplier may not touch another restaurant's order", () =>
  advance('t8', 'accepted', [...t, { status: 'accepted', at: 2 }], RIVAL));

await givenOrder('t9');
await deny('the price may not be edited while advancing', () =>
  update(
    'orders/t9',
    { status: 'accepted', timeline: [...t, { status: 'accepted', at: 2 }], pricing: { subtotal: 0, deliveryFee: 0, priorityFee: 0, promoDiscount: 0, total: 0, currency: 'LKR' } },
    SUPPLIER
  ));

await givenOrder('t10');
await deny('nobody may delete an order', () => remove('orders/t10', SUPPLIER));

await givenOrder('t11');
await deny('earlier timeline entries may not be rewritten while advancing', () =>
  advance('t11', 'accepted', [{ status: 'new', at: 999 }, { status: 'accepted', at: 2 }], SUPPLIER));

// The EXACT write `advanceOrder(order, 'cancelled', { reason })` sends.
await givenOrder('t12');
await allow('the supplier may cancel with a reason', () =>
  update('orders/t12', {
    status: 'cancelled',
    timeline: [...t, { status: 'cancelled', at: 2, by: 'restaurant' }],
    cancelReason: 'Items out of stock',
  }, SUPPLIER));

await givenOrder('t13');
await deny('a reason may only accompany a cancellation', () =>
  update('orders/t13', {
    status: 'accepted', timeline: [...t, { status: 'accepted', at: 2 }], cancelReason: 'Sneaky',
  }, SUPPLIER));

await givenOrder('t14');
await deny('a cancel reason may not exceed 120 characters', () =>
  update('orders/t14', {
    status: 'cancelled',
    timeline: [...t, { status: 'cancelled', at: 2 }],
    cancelReason: 'x'.repeat(121),
  }, SUPPLIER));

// ── Customer cancelling ────────────────────────────────────────────────────
// `cancelOrder()` in modules/food/services/orders.ts: the customer may call off
// their own order only while it is still 'new'.
section('customer cancelling');
const customerCancel = (id, as, extra = {}) =>
  update(`orders/${id}`, {
    status: 'cancelled',
    timeline: [...t, { status: 'cancelled', at: 2, by: 'customer' }],
    ...extra,
  }, as);

await givenOrder('c1');
await allow('the customer may cancel their own order while it is new', () =>
  customerCancel('c1', CUSTOMER));

await givenOrder('c2', { status: 'accepted', timeline: [...t, { status: 'accepted', at: 2 }] });
await deny('the customer may not cancel once the restaurant accepted', () =>
  update('orders/c2', {
    status: 'cancelled',
    timeline: [...t, { status: 'accepted', at: 2 }, { status: 'cancelled', at: 3, by: 'customer' }],
  }, CUSTOMER));

await givenOrder('c3');
await deny("a customer may not cancel someone else's order", () => customerCancel('c3', OTHER));

await givenOrder('c4');
await deny('the customer may not move their order to any other status', () =>
  advance('c4', 'delivered', [...t, { status: 'delivered', at: 2 }], CUSTOMER));

await givenOrder('c5');
await deny('the customer may not change anything else while cancelling', () =>
  customerCancel('c5', CUSTOMER, { pricing: { subtotal: 0, deliveryFee: 0, priorityFee: 0, promoDiscount: 0, total: 0, currency: 'LKR' } }));

await givenOrder('c6');
await deny('the customer may not give a restaurant cancel reason', () =>
  customerCancel('c6', CUSTOMER, { cancelReason: 'Changed my mind' }));

await givenOrder('c7');
await deny('the customer cancel must append exactly one matching entry', () =>
  update('orders/c7', { status: 'cancelled', timeline: [...t, { status: 'accepted', at: 2 }] }, CUSTOMER));

await givenOrder('c8', { status: 'cancelled', timeline: [...t, { status: 'cancelled', at: 2 }] });
await deny('an already-cancelled order cannot be cancelled again', () =>
  update('orders/c8', {
    status: 'cancelled',
    timeline: [...t, { status: 'cancelled', at: 2 }, { status: 'cancelled', at: 3 }],
  }, CUSTOMER));

// The customer's own order list — `listMyOrders()` queries userId == uid.
await allow('the customer may list their own orders', () =>
  request('POST', ':runQuery', {
    as: CUSTOMER,
    rawBody: {
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: CUSTOMER } } },
        limit: 50,
      },
    },
  }));

// The supplier's live list — `watchActiveOrders()` queries merchantId == X && status in ACTIVE.
const activeQuery = (merchantId) => ({
  structuredQuery: {
    from: [{ collectionId: 'orders' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'merchantId' }, op: 'EQUAL', value: { stringValue: merchantId } } },
          {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'IN',
              value: encode(['new', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up']),
            },
          },
        ],
      },
    },
    limit: 200,
  },
});
await allow("the supplier may query its restaurant's active orders", () =>
  request('POST', ':runQuery', { as: SUPPLIER, rawBody: activeQuery('open-shop') }));
await deny("a rival may not query another restaurant's active orders", () =>
  request('POST', ':runQuery', { as: RIVAL, rawBody: activeQuery('open-shop') }));

// ── Reviews ────────────────────────────────────────────────────────────────
// Customers write reviews; the restaurant's owner may only reply to them and
// archive them on its own Reviews screen (Figma 385:5924) — see
// apps/azglobe/src/supplier/services/reviews.ts.
section('reviews');
const REVIEW = 'merchants/open-shop/reviews/rv1';
const reviewBody = (over = {}) => ({
  userId: CUSTOMER,
  userName: 'Vanan',
  orderId: 'o1',
  merchantId: 'open-shop',
  rating: 4,
  text: 'Great kottu',
  dishTag: 'Chicken Kottu',
  helpfulCount: 0,
  createdAt: 1,
  ...over,
});
const replyOf = (text, createdAt = 2) => ({ reply: { text, createdAt } });
// REST semantics: a masked field missing from the body is deleted.
const clearReply = (as) => request('PATCH', REVIEW, { as, body: {}, updateMask: ['reply'] });
await seedDoc(REVIEW, reviewBody());

await allow('anyone may read a restaurant’s reviews', () => list('merchants/open-shop/reviews', null));

// The owner's side.
await allow('the owner may reply to a review', () =>
  update(REVIEW, replyOf('Thank you, Vanan!'), SUPPLIER));
await allow('the owner may edit that reply', () =>
  update(REVIEW, replyOf('Thank you so much, Vanan! 🙏', 3), SUPPLIER));
await allow('a reply of exactly 1000 characters is accepted', () =>
  update(REVIEW, replyOf('x'.repeat(1000), 4), SUPPLIER));
await allow('the owner may hide a review from their list', () =>
  update(REVIEW, { hiddenByMerchant: true }, SUPPLIER));
await allow('the owner may unhide it', () => update(REVIEW, { hiddenByMerchant: false }, SUPPLIER));
await allow('the owner may delete their reply', () => clearReply(SUPPLIER));
await deny('a reply may not be blank', () => update(REVIEW, replyOf('   '), SUPPLIER));
await deny('a reply may not exceed 1000 characters', () =>
  update(REVIEW, replyOf('x'.repeat(1001)), SUPPLIER));
await deny('a reply is { text, createdAt } and nothing more', () =>
  update(REVIEW, { reply: { text: 'Hi', createdAt: 2, pinned: true } }, SUPPLIER));
await deny('a reply must carry when it was written', () =>
  update(REVIEW, { reply: { text: 'Hi' } }, SUPPLIER));
await deny('a reply may not be a bare string', () => update(REVIEW, { reply: 'Thanks' }, SUPPLIER));
await deny('hiddenByMerchant must be a boolean', () =>
  update(REVIEW, { hiddenByMerchant: 'yes' }, SUPPLIER));
await deny('the owner may not change the stars', () => update(REVIEW, { rating: 5 }, SUPPLIER));
await deny('the owner may not rewrite the review', () =>
  update(REVIEW, { text: 'Best place ever' }, SUPPLIER));
await deny('the owner may not change the stars while replying', () =>
  update(REVIEW, { rating: 5, ...replyOf('Thanks') }, SUPPLIER));
await deny('the owner may not delete a customer review', () => remove(REVIEW, SUPPLIER));
await deny('a rival restaurant may not reply', () =>
  update(REVIEW, replyOf('Try us instead'), RIVAL));
await deny('a rival restaurant may not hide it', () =>
  update(REVIEW, { hiddenByMerchant: true }, RIVAL));
await seedDoc('merchants/mis-seeded-shop/reviews/rv9', reviewBody({ merchantId: 'mis-seeded-shop' }));
await deny('a customer named on a merchant still may not reply as it', () =>
  request('PATCH', 'merchants/mis-seeded-shop/reviews/rv9', {
    as: CUSTOMER, body: replyOf('Fake reply'), updateMask: ['reply'],
  }));

// The author's side.
await allow('the author may change their stars and words', () =>
  update(REVIEW, { rating: 5, text: 'Even better the second time' }, CUSTOMER));
await deny('the author may not rate above 5', () => update(REVIEW, { rating: 6 }, CUSTOMER));
await deny('the author may not rate below 1', () => update(REVIEW, { rating: 0 }, CUSTOMER));
await deny('the rating must stay a number', () => update(REVIEW, { rating: 'five' }, CUSTOMER));
await deny('the author may not inflate the helpful count', () =>
  update(REVIEW, { helpfulCount: 99 }, CUSTOMER));
await deny('the author may not reassign the review', () => update(REVIEW, { userId: OTHER }, CUSTOMER));
await deny('the author may not move it to another order', () =>
  update(REVIEW, { orderId: 'o2' }, CUSTOMER));
await deny('the author may not move it to another restaurant', () =>
  update(REVIEW, { merchantId: 'closed-shop' }, CUSTOMER));
await deny('the author may not backdate it', () => update(REVIEW, { createdAt: 0 }, CUSTOMER));
await deny("the author may not write the restaurant's reply", () =>
  update(REVIEW, replyOf('Glad you liked it — The Management'), CUSTOMER));
await deny('the author may not un-hide or hide it for the owner', () =>
  update(REVIEW, { hiddenByMerchant: true }, CUSTOMER));
await deny('another customer may not edit it', () => update(REVIEW, { text: 'Terrible' }, OTHER));
await deny('a supplier account may not write a review', () =>
  set('merchants/open-shop/reviews/rv2', reviewBody({ userId: SUPPLIER }), SUPPLIER));

// Creating a review: one per delivered order, stored under the order's id.
await givenOrder('rvo1', { status: 'delivered', timeline: [{ status: 'delivered', at: 1 }] });
await givenOrder('rvo2', { status: 'delivered', timeline: [{ status: 'delivered', at: 1 }] });
await givenOrder('rvo3', { status: 'preparing', timeline: [{ status: 'preparing', at: 1 }] });
const fresh = (over = {}) => reviewBody({ createdAt: Date.now(), ...over });
await allow('the customer may review a delivered order, under its id', () =>
  set('merchants/open-shop/reviews/rvo1', fresh({ orderId: 'rvo1' }), CUSTOMER));
await deny('a second review of the same order is refused', () =>
  set('merchants/open-shop/reviews/rvo1', fresh({ orderId: 'rvo1', text: 'Again' }), CUSTOMER));
await deny('a review stored under another id is refused', () =>
  set('merchants/open-shop/reviews/extra', fresh({ orderId: 'rvo2' }), CUSTOMER));
await deny('a review may not arrive with a restaurant reply', () =>
  set('merchants/open-shop/reviews/rvo2', fresh({ orderId: 'rvo2', ...replyOf('Thanks!') }), CUSTOMER));
await deny('a review may not arrive hidden', () =>
  set('merchants/open-shop/reviews/rvo2', fresh({ orderId: 'rvo2', hiddenByMerchant: true }), CUSTOMER));
await deny('a review may not start with helpful votes', () =>
  set('merchants/open-shop/reviews/rvo2', fresh({ orderId: 'rvo2', helpfulCount: 50 }), CUSTOMER));
await deny('a review may not be dated in the future', () =>
  set('merchants/open-shop/reviews/rvo2', fresh({ orderId: 'rvo2', createdAt: Date.now() + 86_400_000 * 365 }), CUSTOMER));
await deny('a review may not be backdated', () =>
  set('merchants/open-shop/reviews/rvo2', fresh({ orderId: 'rvo2', createdAt: 1 }), CUSTOMER));
await deny('an order that is not delivered cannot be reviewed', () =>
  set('merchants/open-shop/reviews/rvo3', fresh({ orderId: 'rvo3' }), CUSTOMER));
await allow('another delivered order may be reviewed', () =>
  set('merchants/open-shop/reviews/rvo2', fresh({ orderId: 'rvo2' }), CUSTOMER));

// ── Customer profiles ──────────────────────────────────────────────────────
section('customer profiles');
await allow('a customer may update their own profile', () =>
  update(`customers/${CUSTOMER}`, { name: 'Vanan' }, CUSTOMER));
await deny('a customer may not create a profile carrying activeOrderId', () =>
  set(`customers/${NEW_PERSON}_2`, { name: 'X', activeOrderId: 'o1' }, `${NEW_PERSON}_2`));
await deny('a customer may not read another profile', () => read(`customers/${CUSTOMER}`, OTHER));
await deny('a customer may not set their own activeOrderId', () =>
  update(`customers/${CUSTOMER}`, { activeOrderId: 'o1' }, CUSTOMER));

// ── A-Z Groups (messaging) ─────────────────────────────────────────────────
section('messaging groups');
const chatMembers = (over = {}) => ({
  [SUPPLIER]: { name: "Mama's Kitchen", role: 'Service Provider' },
  ...over,
});
const chatGroup = (over = {}) => ({
  name: 'Regulars',
  description: 'News for our regulars',
  category: 'Food',
  image: '',
  creator: "Mama's Kitchen",
  owner: SUPPLIER,
  rules: 'Be kind.',
  permissions: { posting: 'everyone', editing: 'admins', joining: 'anyone', polls: true, events: true },
  members: chatMembers(),
  memberIds: [SUPPLIER],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const chatMessage = (sender, over = {}) => ({
  groupId: 'g1', sender, name: 'X', text: 'Hello', kind: 'text', at: 5, reactions: {}, ...over,
});
const withCustomer = { members: chatMembers({ [CUSTOMER]: { name: 'Vanan', role: 'Member' } }), memberIds: [SUPPLIER, CUSTOMER] };

await allow('a supplier may create a group as its sole member and owner', () =>
  set('chatGroups/g1', chatGroup(), SUPPLIER));
await deny('a CUSTOMER may not create a group', () =>
  set('chatGroups/g2', chatGroup({ owner: CUSTOMER, memberIds: [CUSTOMER], members: { [CUSTOMER]: { name: 'V', role: 'Service Provider' } } }), CUSTOMER));
await deny('a supplier may not create a group owned by another account', () =>
  set('chatGroups/g2', chatGroup({ owner: RIVAL }), SUPPLIER));
await deny('a non-member may not read a group', () => read('chatGroups/g1', CUSTOMER));
await deny('a non-member may not add themselves to a group', () =>
  update('chatGroups/g1', withCustomer, CUSTOMER));
await allow('the owner may add a person', () => update('chatGroups/g1', withCustomer, SUPPLIER));
await allow('a member may read their group', () => read('chatGroups/g1', CUSTOMER));
await deny('a plain member may not add people', () =>
  update('chatGroups/g1', {
    members: chatMembers({ [CUSTOMER]: { name: 'Vanan', role: 'Member' }, [OTHER]: { name: 'O', role: 'Member' } }),
    memberIds: [SUPPLIER, CUSTOMER, OTHER],
  }, CUSTOMER));
await deny('a plain member may not make themselves an admin', () =>
  update('chatGroups/g1', { members: chatMembers({ [CUSTOMER]: { name: 'Vanan', role: 'Admin' } }) }, CUSTOMER));
await deny('a plain member may not rename the group while editing is admins-only', () =>
  update('chatGroups/g1', { name: 'Mine now' }, CUSTOMER));

await allow('a member may post a message as themselves', () =>
  set('chatGroups/g1/messages/m1', chatMessage(CUSTOMER), CUSTOMER));
await deny("a member may not post in another member's name", () =>
  set('chatGroups/g1/messages/m2', chatMessage(SUPPLIER), CUSTOMER));
await deny('a non-member may not post', () =>
  set('chatGroups/g1/messages/m2', chatMessage(OTHER), OTHER));
await deny('a non-member may not read messages', () => read('chatGroups/g1/messages/m1', OTHER));
await allow('another member may read a message', () => read('chatGroups/g1/messages/m1', SUPPLIER));
await allow('a member may react to another member’s message', () =>
  update('chatGroups/g1/messages/m1', { reactions: { '👍': [SUPPLIER] } }, SUPPLIER));
await allow('the sender may edit their own message', () =>
  update('chatGroups/g1/messages/m1', { text: 'Hello there', edited: true }, CUSTOMER));
await deny('a message may not be reassigned to another sender', () =>
  update('chatGroups/g1/messages/m1', { sender: SUPPLIER }, CUSTOMER));

await allow('a member may store a file for their group', () =>
  set('chatFiles/f1', { groupId: 'g1', sender: CUSTOMER, mime: 'image/jpeg', data: 'AAAA', at: 5 }, CUSTOMER));
await deny('a non-member may not read a group’s file', () => read('chatFiles/f1', OTHER));
await allow('a member may read a group’s file', () => read('chatFiles/f1', SUPPLIER));
await deny('a non-member may not store a file in a group', () =>
  set('chatFiles/f2', { groupId: 'g1', sender: OTHER, mime: 'image/jpeg', data: 'AAAA', at: 5 }, OTHER));

await allow('the owner may promote a member to admin', () =>
  update('chatGroups/g1', { members: chatMembers({ [CUSTOMER]: { name: 'Vanan', role: 'Admin' } }) }, SUPPLIER));
await allow('an admin may add a person', () =>
  update('chatGroups/g1', {
    members: chatMembers({ [CUSTOMER]: { name: 'Vanan', role: 'Admin' }, [OTHER]: { name: 'O', role: 'Member' } }),
    memberIds: [SUPPLIER, CUSTOMER, OTHER],
  }, CUSTOMER));
await deny('an admin may not remove the owner', () =>
  update('chatGroups/g1', {
    members: { [CUSTOMER]: { name: 'Vanan', role: 'Admin' }, [OTHER]: { name: 'O', role: 'Member' } },
    memberIds: [CUSTOMER, OTHER],
  }, CUSTOMER));
await deny('an admin may not take ownership', () => update('chatGroups/g1', { owner: CUSTOMER }, CUSTOMER));
await deny('members and memberIds may not drift apart', () =>
  update('chatGroups/g1', { memberIds: [SUPPLIER, CUSTOMER] }, CUSTOMER));
await deny('a member may not remove somebody else by "leaving"', () =>
  update('chatGroups/g1', {
    members: chatMembers({ [OTHER]: { name: 'O', role: 'Member' } }),
    memberIds: [SUPPLIER, OTHER],
  }, OTHER));
await allow('a member may leave', () =>
  update('chatGroups/g1', {
    members: chatMembers({ [CUSTOMER]: { name: 'Vanan', role: 'Admin' } }),
    memberIds: [SUPPLIER, CUSTOMER],
  }, OTHER));
await deny('someone who left can no longer read the group', () => read('chatGroups/g1', OTHER));
await deny('someone who left can no longer read its messages', () =>
  read('chatGroups/g1/messages/m1', OTHER));

section('messaging directory');
await allow('an account may list itself under its own sign-in number', () =>
  set(`chatDirectory/${encodeURIComponent(PHONES[CUSTOMER])}`, { uid: CUSTOMER, name: 'Vanan', kind: 'customer' }, CUSTOMER));
await deny("an account may not claim somebody else's number", () =>
  set(`chatDirectory/${encodeURIComponent(PHONES[OTHER])}`, { uid: CUSTOMER, name: 'Vanan', kind: 'customer' }, CUSTOMER));
await deny('an account may not list another uid under its number', () =>
  set(`chatDirectory/${encodeURIComponent(PHONES[CUSTOMER])}`, { uid: OTHER, name: 'Vanan', kind: 'customer' }, CUSTOMER));
await allow('a signed-in account may look up a number it knows', () =>
  read(`chatDirectory/${encodeURIComponent(PHONES[CUSTOMER])}`, SUPPLIER));
await deny('nobody may list the directory', () => list('chatDirectory', SUPPLIER));
await deny('an anonymous visitor may not look up a number', () =>
  read(`chatDirectory/${encodeURIComponent(PHONES[CUSTOMER])}`, null));
await allow('a member keeps their own chat settings', () =>
  set(`chatUsers/${CUSTOMER}`, { muted: ['g1'] }, CUSTOMER));
await deny("a member may not read another member's chat settings", () =>
  read(`chatUsers/${CUSTOMER}`, SUPPLIER));

console.log('\nfirestore.rules\n');
console.log(results.join('\n'));
const total = results.filter((r) => r.includes('PASS') || r.includes('FAIL')).length;
console.log(`\n${total - failures}/${total} passed`);
process.exit(failures ? 1 : 0);
