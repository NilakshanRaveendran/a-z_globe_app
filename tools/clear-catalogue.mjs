#!/usr/bin/env node
/**
 * Delete the seeded catalogue so every restaurant on A-Z Globe is one a real
 * supplier created in the app.
 *
 *   node tools/clear-catalogue.mjs [--dry-run] [--yes]
 *
 * The project was bootstrapped with `tools/seed.mjs`, which copied the Figma
 * fixtures into Firestore so the screens had something to render before the
 * supplier flow existed. That flow exists now, so the fixtures are no longer
 * scaffolding — they are five fake restaurants a customer can order from.
 *
 * Removes: merchants/** (with menuItems and reviews), popularDishes,
 * promotions, and the orders placed against the seeded merchants.
 *
 * Does NOT touch accounts. customers/, suppliers/ and accountLinks/ are real
 * identities, and deleting them would orphan the Firebase Auth users.
 *
 * Does NOT touch `categories` either, unless --categories is passed. Those are
 * the platform's food taxonomy from Figma (the category circles on Order Food),
 * not a supplier's data — and `firestore.rules` makes them write:false, so no
 * app flow can recreate them. Deleting them would empty that row permanently.
 *
 * Credentials come from firebase/service-account.json.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const assumeYes = argv.includes('--yes');
const clearCategories = argv.includes('--categories');

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'firebase/service-account.json';
if (!existsSync(KEY_PATH)) {
  console.error(`No credentials at ${KEY_PATH}.`);
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const say = (m) => console.log(`${dryRun ? '[dry-run] ' : ''}${m}`);

/** Delete a collection in batches, including the subcollections named. */
async function deleteCollection(path, subcollections = []) {
  const snap = await db.collection(path).get();
  if (snap.empty) {
    say(`${path}: empty`);
    return 0;
  }
  let count = 0;
  for (const docSnap of snap.docs) {
    for (const sub of subcollections) {
      const subSnap = await docSnap.ref.collection(sub).get();
      for (const s of subSnap.docs) {
        say(`  ${path}/${docSnap.id}/${sub}/${s.id}`);
        if (!dryRun) await s.ref.delete();
        count++;
      }
    }
    say(`${path}/${docSnap.id}`);
    if (!dryRun) await docSnap.ref.delete();
    count++;
  }
  return count;
}

console.log(`project: ${serviceAccount.project_id}\n`);

const merchants = await db.collection('merchants').get();
const orders = await db.collection('orders').get();

console.log(
  `About to delete ${merchants.size} merchants (with their menus and reviews), ` +
    `${orders.size} orders, and the seeded promotions, categories and popular dishes.\n` +
    'Accounts (customers/, suppliers/, accountLinks/) are left untouched.\n'
);

if (!dryRun && !assumeYes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "delete" to confirm: ');
  rl.close();
  if (answer.trim() !== 'delete') {
    console.log('Aborted — nothing was deleted.');
    process.exit(0);
  }
}

let total = 0;
total += await deleteCollection('merchants', ['menuItems', 'reviews']);
total += await deleteCollection('orders');
total += await deleteCollection('popularDishes');
total += await deleteCollection('promotions');
if (clearCategories) total += await deleteCollection('categories');
else say('categories: kept (platform taxonomy — pass --categories to remove)');

console.log(`\n${total} documents ${dryRun ? 'would be' : ''} deleted.`);
if (!dryRun) {
  console.log('The catalogue is now empty. Add a restaurant from the app to fill it.');
}
process.exit(0);
