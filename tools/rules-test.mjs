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

async function request(method, path, { as = null, body, updateMask } = {}) {
  const token = tokenFor(as);
  const qs = updateMask
    ? '?' + updateMask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
    : '';
  const res = await fetch(`${BASE}/${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify({ fields: fields(body) }) } : {}),
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

// ── Customer profiles ──────────────────────────────────────────────────────
section('customer profiles');
await allow('a customer may update their own profile', () =>
  update(`customers/${CUSTOMER}`, { name: 'Vanan' }, CUSTOMER));
await deny('a customer may not create a profile carrying activeOrderId', () =>
  set(`customers/${NEW_PERSON}_2`, { name: 'X', activeOrderId: 'o1' }, `${NEW_PERSON}_2`));
await deny('a customer may not read another profile', () => read(`customers/${CUSTOMER}`, OTHER));
await deny('a customer may not set their own activeOrderId', () =>
  update(`customers/${CUSTOMER}`, { activeOrderId: 'o1' }, CUSTOMER));

console.log('\nfirestore.rules\n');
console.log(results.join('\n'));
const total = results.filter((r) => r.includes('PASS') || r.includes('FAIL')).length;
console.log(`\n${total - failures}/${total} passed`);
process.exit(failures ? 1 : 0);
