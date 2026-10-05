import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const require = createRequire(import.meta.url);
let source = stripTypeScriptTypes(await readFile(new URL('../apps/azglobe/src/modules/food/store/activeOrder.ts', import.meta.url), 'utf8'));
source = source.replace("'zustand'", JSON.stringify(pathToFileURL(require.resolve('zustand')).href))
  .replace("'zustand/middleware'", JSON.stringify(pathToFileURL(require.resolve('zustand/middleware')).href))
  .replace("import { createStorage } from '@core/storage';", `const data = new Map(); const createStorage = () => ({getString: key => data.get(key), set: (key, value) => data.set(key, value), remove: key => data.delete(key)});`);
const { useActiveOrder: store } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('multiple checkouts retain all orders and retries do not duplicate trackers', () => {
  store.getState().setOrderId(null);
  store.getState().addOrderIds(['first']);
  store.getState().addOrderIds(['second', 'first']);
  store.getState().addOrderIds(['third']);
  assert.deepEqual(store.getState().orderIds, ['first', 'second', 'third']);
});
test('finishing or reviewing one restaurant preserves the others across reload', async () => {
  store.getState().removeOrderId('second');
  store.getState().markReviewPrompted('first');
  assert.deepEqual(store.getState().orderIds, ['third']);
  await store.persist.rehydrate();
  assert.deepEqual(store.getState().orderIds, ['third']);
  assert.ok(store.getState().reviewPrompted.includes('first'));
});
test('legacy single-order storage migrates and sign-out clears every tracker', () => {
  const merged = store.persist.getOptions().merge({orderId:'legacy', reviewPrompted:[]}, store.getState());
  assert.deepEqual(merged.orderIds, ['legacy']);
  store.getState().setOrderId(null);
  assert.deepEqual(store.getState().orderIds, []);
  assert.equal(store.getState().orderId, null);
});
