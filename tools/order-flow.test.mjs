import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const read = async path => stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'));
const depsUrl = moduleUrl(`
  export const orders = new Map();
  export const listeners = new Set();
  export const demoListeners = new Set();
  export let ready = false;
  export let failAt = null;
  export const setReady = value => ready = value;
  export const failNext = status => failAt = status;
  export const isFirebaseReady = () => ready;
  export const getApp = () => ({});
  export const getFirestore = () => ({});
  export const collection = (_, path) => path;
  export const doc = (_, id) => id;
  export const where = (field, op, value) => ({ field, op, value });
  export const orderBy = () => ({});
  export const limit = () => ({});
  export const query = (_, ...filters) => filters;
  const matches = (row, filters) => filters.every(f => !f.field || (f.op === 'in' ? f.value.includes(row[f.field]) : row[f.field] === f.value));
  const rowsFor = filters => [...orders.values()].filter(row => matches(row, filters));
  export const emit = () => {
    for (const l of listeners) l.next({ docs: rowsFor(l.filters).map(row => ({ id: row.id, data: () => row })) });
    for (const fn of demoListeners) fn();
  };
  export const onSnapshot = (filters, next, error) => {
    const l = { filters, next, error }; listeners.add(l); emit();
    return () => listeners.delete(l);
  };
  export const readCollection = async (_, spec) => ({ rows: rowsFor(spec.where.map(([field, op, value]) => ({ field, op, value }))) });
  export const updateDoc = async (id, change) => {
    if (change.status === failAt) { failAt = null; throw new Error('offline'); }
    const previous = orders.get(id);
    const next = { new: 'accepted', accepted: 'preparing', preparing: 'ready_for_pickup', ready_for_pickup: 'picked_up', picked_up: 'delivered' };
    if (next[previous.status] !== change.status && !(change.status === 'cancelled' && ['new', 'accepted', 'preparing', 'ready_for_pickup'].includes(previous.status))) throw new Error('illegal transition');
    if (change.timeline.length !== previous.timeline.length + 1) throw new Error('invalid timeline');
    if (JSON.stringify(change.timeline.slice(0, -1)) !== JSON.stringify(previous.timeline)) throw new Error('rewritten timeline');
    orders.set(id, { ...previous, ...change }); emit();
  };
  export const colors = { palette: new Proxy({}, { get: () => '#000' }) };
  export const startOfDay = now => new Date(now).setHours(0, 0, 0, 0);
  export const normalizeOrder = order => order;
  export const readDemoMerchantOrders = id => [...orders.values()].filter(o => o.merchantId === id);
  export const subscribeDemoOrders = fn => { demoListeners.add(fn); return () => demoListeners.delete(fn); };
  export const updateDemoOrder = (merchant, id, edit) => { const next = edit(orders.get(id)); orders.set(id, next); emit(); return next; };
  export const writeDemoMerchantOrders = (_, rows) => rows.forEach(row => orders.set(row.id, row));
  export const findDemoRestaurant = () => null;
  export const countOfferUse = async () => {};
  export const isSeededDemoRestaurant = () => false;
`);
const deps = await import(depsUrl);
const stepsUrl = moduleUrl(await read('../apps/azglobe/src/supplier/services/orderSteps.ts'));
let source = await read('../apps/azglobe/src/supplier/services/orders.ts');
source = source.replaceAll("'./orderSteps'", JSON.stringify(stepsUrl));
for (const name of ['@core/firebase/firestore', '@core/firebase', '@core/firebase/db', '@core/theme', '@core/utils/datetime', '@modules/food/services/orders', '@modules/food/services/demoCatalogue', './offers', './restaurants']) {
  source = source.replaceAll(`'${name}'`, JSON.stringify(depsUrl));
}
const service = await import(moduleUrl(source));
const makeOrder = orderType => ({ id: 'order', merchantId: 'restaurant', orderType, status: 'new', timeline: [{ status: 'new', at: 1 }], createdAt: Date.now() - 3 * 86400000 });

for (const firebase of [false, true]) {
  for (const orderType of ['delivery', 'pickup']) {
    test(`${firebase ? 'Firebase adapter' : 'demo'}: ${orderType} flows live from Active to Completed and History, even across days`, async () => {
      deps.setReady(firebase);
      deps.orders.clear();
      let current = makeOrder(orderType);
      deps.orders.set(current.id, current);
      let active = [], completed = [];
      const stopActive = service.watchActiveOrders(['restaurant'], rows => active = rows);
      const stopCompleted = service.watchCompletedOrders(['restaurant'], rows => completed = rows);
      try {
        assert.equal(active.length, 1);
        assert.equal(completed.length, 0);
        for (let i = 0; i < 3; i++) {
          const step = service.nextStep(current.status, orderType);
          current = await service.advanceOrderStage(current, step.to);
        }
        assert.equal(current.status, 'delivered');
        assert.deepEqual(current.timeline.map(t => t.status), ['new', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered']);
        assert.equal(active.length, 0);
        assert.equal(completed[0].id, current.id);
        assert.equal((await service.listCompletedOrders('restaurant'))[0].id, current.id);
        assert.equal((await service.listOrderHistory('restaurant'))[0].id, current.id);
      } finally { stopActive(); stopCompleted(); }
      assert.equal(deps.listeners.size, 0);
      assert.equal(deps.demoListeners.size, 0);
    });
  }
}

test('a failed intermediate write stays active and the next attempt resumes its real timeline', async () => {
  deps.setReady(true);
  deps.orders.clear();
  let order = makeOrder('delivery');
  deps.orders.set(order.id, order);
  order = await service.advanceOrderStage(order, 'accepted');
  deps.failNext('ready_for_pickup');
  await assert.rejects(service.advanceOrderStage(order, 'picked_up'), /offline/);
  order = (await service.listActiveOrders('restaurant'))[0];
  assert.equal(order.status, 'preparing');
  assert.deepEqual(await service.listCompletedOrders('restaurant'), []);
  order = await service.advanceOrderStage(order, service.nextStep(order.status, order.orderType).to);
  deps.failNext('delivered');
  await assert.rejects(service.advanceOrderStage(order, 'delivered'), /offline/);
  assert.equal((await service.listActiveOrders('restaurant'))[0].status, 'picked_up');
  assert.deepEqual(await service.listCompletedOrders('restaurant'), []);
  order = await service.advanceOrderStage(order, 'delivered');
  assert.equal(order.timeline.length, 6);
  assert.equal((await service.listCompletedOrders('restaurant')).length, 1);
});

for (const firebase of [false, true]) {
  test(`${firebase ? 'Firebase adapter' : 'demo'}: cancellation moves live into closed orders without appearing completed`, async () => {
    deps.setReady(firebase);
    deps.orders.clear();
    const order = makeOrder('delivery');
    deps.orders.set(order.id, order);
    let active = [], closed = [];
    const stopActive = service.watchActiveOrders(['restaurant'], rows => active = rows);
    const stopClosed = service.watchClosedOrders(['restaurant'], rows => closed = rows);
    try {
      await service.cancelOrder(order, 'Items out of stock');
      assert.equal(active.length, 0);
      assert.equal(closed[0].status, 'cancelled');
      assert.equal(closed[0].cancelReason, 'Items out of stock');
      assert.equal((await service.listClosedOrders('restaurant'))[0].status, 'cancelled');
      assert.deepEqual(await service.listCompletedOrders('restaurant'), []);
    } finally { stopActive(); stopClosed(); }
  });
}
