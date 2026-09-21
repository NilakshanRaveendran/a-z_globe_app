#!/usr/bin/env node
/**
 * Verify the DEPLOYED security rules against the real project.
 *
 *   node tools/verify-live-rules.mjs
 *
 * `npm run test:rules` covers the rules exhaustively, but it runs against the
 * emulator with fixtures. This checks the far narrower question that the
 * emulator cannot answer: that what is actually deployed, against the data that
 * actually exists, behaves as intended for the real customer and supplier
 * accounts.
 *
 * It signs in as each account using a custom token minted by the admin SDK, so
 * it needs no SMS and no test-number setup, then drives the Firestore REST API
 * as that user — exactly the path the apps take.
 *
 * NON-DESTRUCTIVE. Every assertion is either a read, a write that is expected
 * to be refused (and so changes nothing), or the one allowed write, which
 * writes a field back to the value it already holds.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(readFileSync('firebase/service-account.json', 'utf8'));
const PROJECT = serviceAccount.project_id;
initializeApp({ credential: cert(serviceAccount), projectId: PROJECT });
const db = getFirestore();

// The Web API key lives in the Android config; it is not a secret (it ships in
// every client) but it is what the identity toolkit endpoint requires.
const googleServices = JSON.parse(
  readFileSync('firebase/app/google-services.json', 'utf8')
);
const API_KEY = googleServices.client[0].api_key[0].current_key;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Exchange an admin-minted custom token for a real ID token. */
async function idTokenFor(uid) {
  const customToken = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).idToken;
}

const encode = (v) =>
  typeof v === 'string'
    ? { stringValue: v }
    : typeof v === 'boolean'
      ? { booleanValue: v }
      : Number.isInteger(v)
        ? { integerValue: String(v) }
        : { doubleValue: v };

async function req(method, path, token, { body, updateMask } = {}) {
  const qs = updateMask
    ? '?' + updateMask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
    : '';
  return fetch(`${BASE}/${path}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body
      ? {
          body: JSON.stringify({
            fields: Object.fromEntries(Object.entries(body).map(([k, v]) => [k, encode(v)])),
          }),
        }
      : {}),
  });
}

let failures = 0;
const out = [];
async function expect(label, want, run) {
  const res = await run();
  const got = res.status === 200 ? 'allow' : res.status === 403 ? 'deny' : `HTTP ${res.status}`;
  if (got === want) out.push(`  PASS  ${label}`);
  else {
    failures++;
    out.push(`  FAIL  ${label}\n          expected ${want}, got ${got}`);
  }
}

// ── Resolve the real accounts ──────────────────────────────────────────────
const [customerSnap] = (await db.collection('customers').limit(1).get()).docs;
const [supplierSnap] = (await db.collection('suppliers').limit(1).get()).docs;
if (!customerSnap || !supplierSnap) {
  console.error('Need one customer and one supplier account. Run tools/migrate-accounts.mjs first.');
  process.exit(1);
}
const CUSTOMER = customerSnap.id;
const SUPPLIER = supplierSnap.id;

const merchantSnap = (await db.collection('merchants').where('supplierId', '==', SUPPLIER).limit(1).get())
  .docs[0];
if (!merchantSnap) {
  console.error(`No merchant owned by supplier ${SUPPLIER}.`);
  process.exit(1);
}
const MERCHANT = merchantSnap.id;
const MERCHANT_NAME = merchantSnap.data().name;

console.log(`project:  ${PROJECT}`);
console.log(`customer: ${CUSTOMER}`);
console.log(`supplier: ${SUPPLIER}`);
console.log(`merchant: ${MERCHANT} ("${MERCHANT_NAME}")\n`);

const asCustomer = await idTokenFor(CUSTOMER);
const asSupplier = await idTokenFor(SUPPLIER);

// ── The customer side ──────────────────────────────────────────────────────
await expect('customer reads their own profile', 'allow', () =>
  req('GET', `customers/${CUSTOMER}`, asCustomer));
await expect('customer may NOT read the supplier profile', 'deny', () =>
  req('GET', `suppliers/${SUPPLIER}`, asCustomer));
await expect('customer may NOT rename the restaurant they are linked to', 'deny', () =>
  req('PATCH', `merchants/${MERCHANT}`, asCustomer, { body: { name: 'Hijacked' }, updateMask: ['name'] }));
await expect('customer may NOT set their own activeOrderId', 'deny', () =>
  req('PATCH', `customers/${CUSTOMER}`, asCustomer, {
    body: { activeOrderId: 'x' },
    updateMask: ['activeOrderId'],
  }));

// ── The supplier side ──────────────────────────────────────────────────────
await expect('supplier reads their own profile', 'allow', () =>
  req('GET', `suppliers/${SUPPLIER}`, asSupplier));
await expect('supplier may NOT read the customer profile', 'deny', () =>
  req('GET', `customers/${CUSTOMER}`, asSupplier));
// The one allowed write: the name is written back unchanged.
await expect('supplier may manage its own restaurant', 'allow', () =>
  req('PATCH', `merchants/${MERCHANT}`, asSupplier, {
    body: { name: MERCHANT_NAME },
    updateMask: ['name'],
  }));
await expect('supplier may NOT edit its own rating', 'deny', () =>
  req('PATCH', `merchants/${MERCHANT}`, asSupplier, {
    body: { rating: 5 },
    updateMask: ['rating'],
  }));
await expect('supplier may NOT reassign ownership', 'deny', () =>
  req('PATCH', `merchants/${MERCHANT}`, asSupplier, {
    body: { supplierId: CUSTOMER },
    updateMask: ['supplierId'],
  }));

console.log('deployed firestore.rules\n');
console.log(out.join('\n'));
console.log(`\n${out.length - failures}/${out.length} passed`);
process.exit(failures ? 1 : 0);
