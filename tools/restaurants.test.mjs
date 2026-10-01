import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const read = async (path) => stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'));
const dependencies = asModule(`
  export const values = new Map();
  export const collections = new Map();
  let ready = false;
  export const writes = [];
  export const setReady = value => { ready = value; };
  export const isFirebaseReady = () => ready;
  export const getApp = () => ({});
  export const getFirestore = () => ({});
  export const collection = (_, path) => path;
  export const doc = (path, id) => path + '/' + id;
  export const serverTimestamp = () => 'server-time';
  export const setDoc = async (path, value) => { writes.push({ path, value }); };
  export const updateDoc = setDoc;
  export const writeBatch = () => {
    const pending = [];
    return {
      update: (path, value) => { pending.push({ path, value, batch: true }); },
      commit: async () => { writes.push(...pending); },
    };
  };
  export const readCollection = async path => ({ rows: collections.get(path) ?? [] });
  export const readDoc = async () => null;
  export const createStorage = ({ id }) => ({
    getString: key => values.get(id + ':' + key),
    set: (key, value) => values.set(id + ':' + key, value),
    remove: key => values.delete(id + ':' + key),
  });
`);

// The shared demo catalogue, wired to the fixtures and the fake storage above.
const fixtures = asModule(await read('../apps/azglobe/src/modules/food/data/fixtures.ts'));
const catalogueUrl = asModule(
  (await read('../apps/azglobe/src/modules/food/services/demoCatalogue.ts'))
    .replaceAll("'@core/storage'", JSON.stringify(dependencies))
    .replaceAll("'../data/fixtures'", JSON.stringify(fixtures))
);

let source = await read('../apps/azglobe/src/supplier/services/restaurants.ts');
const validation = asModule(await read('../apps/azglobe/src/supplier/services/restaurantValidation.ts'));
source = source.replace("'./restaurantValidation'", JSON.stringify(validation));
source = source.replaceAll("'@modules/food/services/demoCatalogue'", JSON.stringify(catalogueUrl));
for (const name of ['@core/firebase/firestore', '@core/firebase', '@core/firebase/db', '@core/storage']) {
  source = source.replaceAll(`'${name}'`, JSON.stringify(dependencies));
}
const { setReady, writes, values, collections } = await import(dependencies);
const catalogue = await import(catalogueUrl);
const service = await import(asModule(source));
const input = {
  name: ' Demo Kitchen ', cuisines: ['Sri Lankan'], tagline: 'Fresh meals',
  address: 'Trincomalee', phone: '0710000000', openTime: '7:00 AM', closeTime: '10:00 PM',
  closedDays: ['sun'], prepTimeMin: 20, prepTimeMax: 30, deliveryAvailable: true, deliveryFee: 150,
};
const SEEDED = ['mamas-kitchen', 'yaal-angaadi'];
const created = (list) => list.filter((r) => !SEEDED.includes(r.id));

test('an existing demo store gains the owned fixture restaurants without losing its own', async () => {
  // A browser from before the shared catalogue: one restaurant, no seed version.
  const existing = { id: 'mama-s-kitchen-7ig6h', supplierId: 'demo-provider', name: "Mama's Kitchen", isOpen: false };
  values.set('azglobe-demo-restaurants:restaurants', JSON.stringify([existing]));
  const owned = await service.listOwnedRestaurants('demo-provider');
  assert.deepEqual(owned.map((r) => r.id), ['mamas-kitchen', 'yaal-angaadi', 'mama-s-kitchen-7ig6h']);
  for (const id of SEEDED) {
    const restaurant = owned.find((r) => r.id === id);
    assert.equal(restaurant.supplierId, 'demo-provider');
    assert.equal(restaurant.isOpen, true);
    assert.ok(service.isSeededDemoRestaurant(id));
  }
  assert.equal(service.isSeededDemoRestaurant('mama-s-kitchen-7ig6h'), false);
  // Seeding runs once: removing a seeded restaurant is not undone on the next read.
  values.set('azglobe-demo-restaurants:restaurants', JSON.stringify([existing]));
  assert.deepEqual((await service.listOwnedRestaurants('demo-provider')).map((r) => r.id), ['mama-s-kitchen-7ig6h']);
  values.clear();
});

test('owned fixture restaurants start with their Figma menu, reviews and offers; new ones start empty', async () => {
  assert.ok(catalogue.readDemoMenu('mamas-kitchen').some((i) => i.id === 'mk-chicken-kottu'));
  assert.ok(catalogue.readDemoMenu('mamas-kitchen').every((i) => i.merchantId === 'mamas-kitchen'));
  assert.ok(catalogue.readDemoReviews('mamas-kitchen').length > 0);
  assert.ok(catalogue.readDemoOffers('yaal-angaadi').some((o) => o.active));
  const id = await service.createRestaurant('demo-provider', input);
  assert.deepEqual(catalogue.readDemoMenu(id), []);
  assert.deepEqual(catalogue.readDemoReviews(id), []);
  assert.deepEqual(catalogue.readDemoOffers(id), []);
});

test('each required restaurant field is validated before creation', async () => {
  const { restaurantStepErrors } = await import(validation);
  assert.deepEqual(restaurantStepErrors(input), [null, null, null, null]);
  for (const field of ['name', 'tagline', 'address', 'phone', 'openTime', 'closeTime']) {
    await assert.rejects(service.createRestaurant('demo-provider', { ...input, [field]: '   ' }));
  }
  for (const edits of [{ cuisines: [] }, { cuisines: [' '] }, { phone: 'abc1234567' },
    { openTime: '25:90 PM' }, { deliveryFee: -1 }, { deliveryFee: NaN }, { prepTimeMin: NaN }]) {
    assert.ok(restaurantStepErrors({ ...input, ...edits }).some(Boolean));
  }
  assert.equal(restaurantStepErrors({ ...input, deliveryFee: 0 })[3], null);
  assert.equal(restaurantStepErrors({ ...input, deliveryAvailable: false, deliveryFee: NaN })[3], null);
});

test('demo restaurants persist through module reload, isolate suppliers, and support edits', async () => {
  values.clear();
  const id = await service.createRestaurant('demo-provider', input);
  const restaurant = await service.getOwnedRestaurant(id);
  assert.equal(restaurant.name, 'Demo Kitchen');
  assert.equal(restaurant.isOpen, false);
  assert.equal(restaurant.hours.sun.closed, true);
  assert.equal(created(await service.listOwnedRestaurants('demo-provider')).length, 1);
  assert.deepEqual(await service.listOwnedRestaurants('other-provider'), []);
  await service.updateRestaurant(id, { name: 'Updated Kitchen', deliveryFee: 100 });
  await service.setRestaurantOpen(id, true);
  const reloaded = await import(asModule(source + '\n// Fresh module instance'));
  assert.equal((await reloaded.getOwnedRestaurant(id)).name, 'Updated Kitchen');
  assert.equal((await reloaded.getOwnedRestaurant(id)).isOpen, true);
  assert.equal(writes.length, 0);
  await assert.rejects(service.updateRestaurant('missing', { name: 'Missing' }), /not found/);
  await assert.rejects(service.createRestaurant('', input), /business account/);
});

test('renaming a demo restaurant renames its dishes too', async () => {
  await service.updateRestaurant('mamas-kitchen', { name: "Mama's Kitchen Trinco" });
  const menu = catalogue.readDemoMenu('mamas-kitchen');
  assert.ok(menu.length > 0);
  assert.ok(menu.every((i) => i.merchantName === "Mama's Kitchen Trinco"));
});

test('archiving hides a demo restaurant from its owner but keeps the record', async () => {
  const id = await service.createRestaurant('demo-provider', { ...input, name: 'Archive Me' });
  await service.setRestaurantOpen(id, true);
  await service.archiveRestaurant(id);
  assert.equal((await service.listOwnedRestaurants('demo-provider')).some((r) => r.id === id), false);
  const archived = await service.getOwnedRestaurant(id);
  assert.equal(archived.archived, true);
  assert.equal(archived.isOpen, false);
});

test('configured Firebase uses server writes and never returns demo restaurants', async () => {
  setReady(true);
  writes.length = 0;
  try {
    const id = await service.createRestaurant('live-provider', input);
    assert.equal(writes[0].path, 'merchants/' + id);
    assert.equal(writes[0].value.createdAt, 'server-time');
    assert.deepEqual(await service.listOwnedRestaurants('demo-provider'), []);
    await service.setRestaurantOpen(id, true);
    assert.deepEqual(writes[1].value, { isOpen: true });
    await service.archiveRestaurant(id);
    assert.deepEqual(writes[2], { path: 'merchants/' + id, value: { archived: true, isOpen: false } });

    // A rename rewrites only the dishes that still carry another name, in one batch.
    collections.set(`merchants/${id}/menuItems`, [
      { id: 'a', merchantName: 'Demo Kitchen' },
      { id: 'b', merchantName: 'New Name' },
    ]);
    writes.length = 0;
    await service.updateRestaurant(id, { name: 'New Name' });
    assert.deepEqual(writes, [
      { path: 'merchants/' + id, value: { name: 'New Name' } },
      { path: `merchants/${id}/menuItems/a`, value: { merchantName: 'New Name' }, batch: true },
    ]);
  } finally {
    setReady(false);
  }
});
