#!/usr/bin/env node
/**
 * DEPRECATED — do not run against a real project.
 *
 * This copied the Figma fixtures into Firestore so the screens had something to
 * render before suppliers could create restaurants themselves. That flow now
 * exists (Add Restaurant, 385:4028), so the catalogue a customer browses is
 * entered by the businesses that run it. Running this again would put five fake
 * restaurants back in front of real customers.
 *
 * Kept only for bootstrapping a throwaway dev project, and deliberately not
 * wired to an npm script. `tools/clear-catalogue.mjs` undoes it.
 *
 * ---
 *
 * Seed Firestore with the Figma content.
 *
 * The fixtures in `src/modules/food/data/fixtures.ts` are the single source of
 * this data, so a seeded Firebase project renders exactly like the design — and
 * exactly like the app does before Firebase is configured.
 *
 * Images: by default the documents keep the bundled-asset KEYS (e.g. "kottu"),
 * which `resolveImage` maps to the PNGs shipped in the app. That needs no Cloud
 * Storage bucket and costs nothing. Pass --upload-images to instead upload the
 * PNGs and store public URLs — useful once the catalogue is managed by real
 * merchants rather than by this script.
 *
 * Usage:
 *   node tools/seed.mjs [--project <id>] [--upload-images] [--supplier <uid>]
 *
 * `--supplier` is the uid of the SUPPLIER account that operates these
 * restaurants. It creates `suppliers/{uid}` if absent and stamps every merchant
 * with `supplierId`, which is what `firestore.rules` keys merchant-side
 * permissions on.
 *
 * It must be a supplier account, NOT the uid a person signs in with as a
 * customer. Customer and supplier are separate A-Z Globe accounts with separate
 * Firebase users — see the header of `firestore.rules` and
 * `packages/core/src/account/types.ts`. Passing a customer uid here is refused,
 * because the rules would grant it nothing anyway and a half-broken catalogue
 * is worse than a clear error.
 *
 * Credentials come from firebase/service-account.json, or from
 * GOOGLE_APPLICATION_CREDENTIALS if that is set.
 *
 * Re-runnable: every write is idempotent (documents are keyed by their fixture
 * id and merged).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// firebase-admin v14 is modular; the old `admin.credential.*` namespace is gone.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const projectIdx = argv.indexOf('--project');
const uploadImages = argv.includes('--upload-images');
const supplierIdx = argv.indexOf('--supplier');
const supplierId = supplierIdx >= 0 ? argv[supplierIdx + 1] : undefined;

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'firebase/service-account.json';
if (!existsSync(KEY_PATH)) {
  console.error(
    `No credentials at ${KEY_PATH}.\n` +
      'Firebase Console > Project settings > Service accounts > Generate new private key.'
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
const projectId = projectIdx >= 0 ? argv[projectIdx + 1] : serviceAccount.project_id;

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId,
  ...(uploadImages ? { storageBucket: `${projectId}.firebasestorage.app` } : {}),
});

const db = getFirestore(app);
const bucket = uploadImages ? getStorage(app).bucket() : null;

/** Compile the TypeScript fixtures in memory and import the result. */
async function loadFixtures() {
  const source = join(ROOT, 'apps/azglobe/src/modules/food/data/fixtures.ts');
  if (!existsSync(source)) throw new Error(`fixtures not found at ${source}`);

  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch {
    throw new Error('esbuild is required to read the fixtures. Run:  npm i -D esbuild');
  }

  const built = esbuild.buildSync({
    entryPoints: [source],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    // The fixtures import only types from ../types, which erase at build time.
    external: ['react-native', 'expo-image'],
  });

  const code = built.outputFiles[0].text;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

/** Upload a bundled image and return its public URL. */
async function uploadImage(key) {
  const local = join(ROOT, 'apps/azglobe/assets/images/food', `${key}.png`);
  if (!existsSync(local)) {
    console.warn(`  ! no local image for "${key}" — leaving the key as-is`);
    return key;
  }
  const destination = `merchants/catalogue/${key}.png`;
  await bucket.upload(local, {
    destination,
    metadata: { cacheControl: 'public,max-age=31536000' },
  });
  await bucket.file(destination).makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
}

/**
 * Make sure the uid we are about to stamp onto every merchant really is a
 * supplier account, and create its profile document if it has none.
 *
 * The check is not paperwork. `firestore.rules#ownsMerchant` requires both that
 * `merchants/{id}.supplierId` matches the caller AND that the caller holds a
 * `suppliers/{uid}` profile. Seeding a customer uid would therefore produce a
 * catalogue nobody can administer, failing later and confusingly. Fail here
 * instead, while the fix is one flag.
 */
async function ensureSupplierAccount() {
  if (!supplierId) {
    console.log('merchant supplier: none (pass --supplier <uid>)');
    return;
  }
  const customerSnap = await db.collection('customers').doc(supplierId).get();
  if (customerSnap.exists) {
    console.error(
      `\n${supplierId} is a CUSTOMER account.\n\n` +
        'Customer and supplier are separate A-Z Globe accounts and must be separate\n' +
        'Firebase users. Create a supplier account (sign in to A-Z Globe with\n' +
        'the business phone number) and pass that uid instead.\n'
    );
    process.exit(1);
  }
  const ref = db.collection('suppliers').doc(supplierId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: 'A-Z Globe Seed Supplier',
      phone: null,
      createdAt: Timestamp.now(),
    });
    console.log(`merchant supplier: ${supplierId} (created suppliers/${supplierId})`);
  } else {
    console.log(`merchant supplier: ${supplierId}`);
  }
}

async function main() {
  const { merchants, menuItems, reviews, promotions, foodCategories } = await loadFixtures();

  console.log(`project: ${projectId}`);
  await ensureSupplierAccount();
  console.log(
    `Seeding ${merchants.length} merchants, ${menuItems.length} menu items, ` +
      `${reviews.length} reviews, ${promotions.length} promotions…\n`
  );

  // ── Images ───────────────────────────────────────────────────────────────
  const imageUrls = new Map();
  if (uploadImages) {
    const keys = new Set([...merchants.map((m) => m.coverImage), ...menuItems.map((i) => i.image)]);
    console.log(`Uploading ${keys.size} images…`);
    for (const key of keys) {
      imageUrls.set(key, await uploadImage(key));
      process.stdout.write('.');
    }
    console.log('');
  } else {
    console.log('Using bundled-asset image keys (pass --upload-images for Cloud Storage).\n');
  }
  const url = (key) => imageUrls.get(key) ?? key;

  // ── Merchants + menus + reviews ──────────────────────────────────────────
  for (const merchant of merchants) {
    const ref = db.collection('merchants').doc(merchant.id);
    const { id: _id, ...data } = merchant;
    await ref.set(
      { ...data, coverImage: url(merchant.coverImage), ...(supplierId ? { supplierId } : {}) },
      { merge: true }
    );

    const items = menuItems.filter((i) => i.merchantId === merchant.id);
    let batch = db.batch();
    for (const item of items) {
      const { id: itemId, ...itemData } = item;
      batch.set(
        ref.collection('menuItems').doc(itemId),
        { ...itemData, image: url(item.image) },
        { merge: true }
      );
    }
    await batch.commit();

    const merchantReviews = reviews.filter((r) => r.merchantId === merchant.id);
    if (merchantReviews.length) {
      batch = db.batch();
      for (const review of merchantReviews) {
        const { id: reviewId, ...reviewData } = review;
        batch.set(
          ref.collection('reviews').doc(reviewId),
          { ...reviewData, createdAt: Timestamp.fromMillis(review.createdAt) },
          { merge: true }
        );
      }
      await batch.commit();
    }

    console.log(`  + ${merchant.name} (${items.length} items, ${merchantReviews.length} reviews)`);
  }

  // ── Popular dishes (denormalised so Home is one cheap read) ──────────────
  const popular = [...menuItems].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const popularBatch = db.batch();
  for (const item of popular) {
    const { id, ...data } = item;
    popularBatch.set(
      db.collection('popularDishes').doc(id),
      { ...data, image: url(item.image) },
      { merge: true }
    );
  }
  await popularBatch.commit();
  console.log(`  + ${popular.length} popular dishes`);

  // ── Promotions, keyed by code so the promo lookup is a direct read ───────
  for (const promo of promotions) {
    const { id: _pid, code, validUntil, ...rest } = promo;
    await db
      .collection('promotions')
      .doc(code.toUpperCase())
      .set(
        {
          ...rest,
          code: code.toUpperCase(),
          validUntil: Timestamp.fromMillis(validUntil),
          usedCount: 0,
        },
        { merge: true }
      );
  }
  console.log(`  + ${promotions.length} promotions`);

  // ── Categories ───────────────────────────────────────────────────────────
  const catBatch = db.batch();
  foodCategories.forEach((c, i) => {
    catBatch.set(
      db.collection('categories').doc(c.id),
      { module: 'food', name: c.label, tint: c.tint, sortOrder: i },
      { merge: true }
    );
  });
  await catBatch.commit();
  console.log(`  + ${foodCategories.length} categories`);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
