#!/usr/bin/env node
/**
 * Split customer and supplier identities.
 *
 *   node tools/migrate-accounts.mjs --supplier-phone +94772244482 [--dry-run]
 *   node tools/migrate-accounts.mjs --supplier-uid <existing uid> [--dry-run]
 *   node tools/migrate-accounts.mjs --supplier-phone +94… --create-user
 *
 * A-Z Globe originally had one kind of account. `merchants.ownerId` therefore
 * held the uid a person signs in with as a CUSTOMER, which meant one Firebase
 * user was simultaneously the diner and the restaurant. This migration undoes
 * that:
 *
 *   users/{uid}            ->  customers/{uid}
 *   merchants.ownerId      ->  merchants.supplierId, pointing at a SUPPLIER uid
 *   (new) suppliers/{uid}      the business account, a different Firebase user
 *   (new) accountLinks/…       optional "same person" record, granting nothing
 *
 * The supplier is a real Firebase Auth user with its own phone number, because
 * Firebase Auth keys phone accounts by number: one number cannot produce two
 * users in a project. A restaurant having its own line is the normal case
 * anyway, and it is what keeps the two sign-ins genuinely independent.
 *
 * By default this expects that user to ALREADY exist — sign in once through the
 * app with the business number and it is created for you. `--create-user` makes
 * it here instead, which is only right when the number is not a Firebase test
 * number: a number cannot be both a test number and a real account, so creating
 * the account first is what blocks you from registering the test number later.
 *
 * Re-runnable. Every step checks whether it has already been done, so running
 * it twice is harmless. Nothing is deleted except the obsolete `ownerId` field.
 *
 * Credentials come from firebase/service-account.json, or from
 * GOOGLE_APPLICATION_CREDENTIALS if that is set.
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const supplierPhone = arg('--supplier-phone');
const supplierUidArg = arg('--supplier-uid');
const supplierName = arg('--supplier-name') ?? 'A-Z Globe Restaurants';
const createUser = argv.includes('--create-user');

if (!supplierPhone && !supplierUidArg) {
  console.error(
    'Pass --supplier-phone <E.164> to create the supplier account, or\n' +
      '     --supplier-uid <uid> to use one that already exists.'
  );
  process.exit(1);
}

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'firebase/service-account.json';
if (!existsSync(KEY_PATH)) {
  console.error(`No credentials at ${KEY_PATH}.`);
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();
const auth = getAuth();

const say = (msg) => console.log(`${dryRun ? '[dry-run] ' : ''}${msg}`);

// ── 1. The supplier Firebase user ──────────────────────────────────────────
async function resolveSupplierUid() {
  if (supplierUidArg) {
    const user = await auth.getUser(supplierUidArg).catch(() => null);
    if (!user) throw new Error(`no auth user ${supplierUidArg}`);
    say(`supplier auth user: ${user.uid} (${user.phoneNumber ?? '-'}) — existing`);
    return user.uid;
  }

  const existing = await auth.getUserByPhoneNumber(supplierPhone).catch(() => null);
  if (existing) {
    say(`supplier auth user: ${existing.uid} (${supplierPhone}) — existing`);
    return existing.uid;
  }
  if (!createUser) {
    console.error(
      [
        '',
        `No Firebase user for ${supplierPhone}.`,
        '',
        'Sign in once in A-Z Globe with that number and choose "Business account".',
        'That creates the user; then re-run this command to point the restaurants',
        'at it.',
        '',
        'Pass --create-user to create it here instead. Only do that if the number',
        'is NOT a Firebase test number — a number cannot be both a test number and',
        'a real account, and creating the account first is what blocks you from',
        'registering the test number later.',
        '',
      ].join('\n')
    );
    process.exit(1);
  }
  if (dryRun) {
    say(`would create a supplier auth user for ${supplierPhone}`);
    return '<new-supplier-uid>';
  }
  const created = await auth.createUser({ phoneNumber: supplierPhone, displayName: supplierName });
  say(`supplier auth user: ${created.uid} (${supplierPhone}) — CREATED`);
  return created.uid;
}

// ── 2. users/ -> customers/ ────────────────────────────────────────────────
async function migrateCustomers(supplierUid) {
  const snap = await db.collection('users').get();
  if (snap.empty) {
    say('users/: nothing to migrate');
    return [];
  }
  const moved = [];
  for (const d of snap.docs) {
    if (d.id === supplierUid) {
      // Would make one uid both kinds of account — exactly what this migration
      // exists to prevent.
      throw new Error(
        `users/${d.id} is also the supplier uid. Choose a different supplier account.`
      );
    }
    const target = db.collection('customers').doc(d.id);
    if ((await target.get()).exists) {
      say(`customers/${d.id}: already present, skipping`);
    } else {
      say(`users/${d.id} -> customers/${d.id}`);
      if (!dryRun) await target.set(d.data(), { merge: true });
    }
    moved.push(d.id);
  }
  // The old documents are left in place. They are unreachable — no rule in
  // firestore.rules matches /users/{uid} any more — and keeping them means this
  // migration can be verified, and reverted, without a backup.
  say(`users/: ${moved.length} copied (originals left in place, now unreachable)`);
  return moved;
}

// ── 3. merchants.ownerId -> merchants.supplierId ───────────────────────────
async function migrateMerchants(supplierUid) {
  const snap = await db.collection('merchants').get();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.supplierId === supplierUid && data.ownerId === undefined) {
      say(`merchants/${d.id}: already migrated`);
      continue;
    }
    say(`merchants/${d.id}: ownerId=${data.ownerId ?? '-'} -> supplierId=${supplierUid}`);
    if (!dryRun) {
      await d.ref.update({ supplierId: supplierUid, ownerId: FieldValue.delete() });
    }
  }
  say(`merchants/: ${snap.size} processed`);
}

// ── 4. suppliers/{uid} ─────────────────────────────────────────────────────
async function createSupplierProfile(supplierUid, merchantIds) {
  const ref = db.collection('suppliers').doc(supplierUid);
  if ((await ref.get()).exists) {
    say(`suppliers/${supplierUid}: already present`);
    if (!dryRun) await ref.update({ merchantIds });
    return;
  }
  say(`suppliers/${supplierUid}: creating (${merchantIds.length} businesses)`);
  if (!dryRun) {
    await ref.set({
      name: supplierName,
      phone: supplierPhone ?? null,
      merchantIds,
      createdAt: Timestamp.now(),
    });
  }
}

// ── 5. accountLinks ────────────────────────────────────────────────────────
//
// Records that the person who runs these restaurants is also an A-Z Globe
// customer. This is the "one person, two accounts" case from the brief. It is
// deliberately inert: no security rule reads accountLinks, so the link buys the
// customer account no restaurant powers and the supplier account no access to
// anyone's orders. It exists so the apps can offer account switching.
async function linkAccounts(customerUids, supplierUid) {
  for (const customerUid of customerUids) {
    const id = `${customerUid}_${supplierUid}`;
    const ref = db.collection('accountLinks').doc(id);
    if ((await ref.get()).exists) {
      say(`accountLinks/${id}: already present`);
      continue;
    }
    say(`accountLinks/${id}: linking (confirmed by both, grants no permission)`);
    if (!dryRun) {
      await ref.set({
        customerUid,
        supplierUid,
        confirmedBy: [customerUid, supplierUid],
        status: 'confirmed',
        createdAt: Timestamp.now(),
      });
    }
  }
}

// ── Run ────────────────────────────────────────────────────────────────────
console.log(`project: ${serviceAccount.project_id}\n`);
const supplierUid = await resolveSupplierUid();
const customerUids = await migrateCustomers(supplierUid);
await migrateMerchants(supplierUid);
const merchantIds = (await db.collection('merchants').get()).docs.map((d) => d.id);
await createSupplierProfile(supplierUid, merchantIds);
await linkAccounts(customerUids, supplierUid);

console.log(`\nDone.${dryRun ? ' (nothing was written)' : ''}`);
if (!dryRun && supplierPhone) {
  console.log(
    `\nTo sign in as ${supplierPhone}, add it under\n` +
      'Firebase Console > Authentication > Sign-in method > Phone > ' +
      'Phone numbers for testing.'
  );
}
process.exit(0);
