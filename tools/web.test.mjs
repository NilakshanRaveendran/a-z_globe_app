import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const storageSource = stripTypeScriptTypes(await readFile(new URL('../packages/core/src/storage.web.ts', import.meta.url), 'utf8'));
let version = 0;
const freshStorage = () => import(`data:text/javascript;base64,${Buffer.from(`${storageSource}\n// ${version++}`).toString('base64')}`);

test('browser storage survives a new module instance and isolates each store', async () => {
  const values = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } });
  try {
    const { createStorage } = await freshStorage();
    createStorage({ id: 'cart' }).set('state', 'cart value');
    createStorage({ id: 'address' }).set('state', 'address value');
    const reloaded = await freshStorage();
    assert.equal(reloaded.createStorage({ id: 'cart' }).getString('state'), 'cart value');
    assert.equal(reloaded.createStorage({ id: 'address' }).getString('state'), 'address value');
    reloaded.createStorage({ id: 'cart' }).remove('state');
    assert.equal(reloaded.createStorage({ id: 'cart' }).getString('state'), undefined);
    assert.equal(values.has('cart:state'), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('two page instances sharing localStorage see each other\'s writes', async () => {
  const values = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } });
  try {
    // Two tabs of the app: each has its own module instance, one localStorage.
    const customerTab = (await freshStorage()).createStorage({ id: 'demo-menu' });
    const businessTab = (await freshStorage()).createStorage({ id: 'demo-menu' });
    customerTab.set('menu:mamas-kitchen', 'v1');
    assert.equal(businessTab.getString('menu:mamas-kitchen'), 'v1');
    businessTab.set('menu:mamas-kitchen', 'v2');
    assert.equal(customerTab.getString('menu:mamas-kitchen'), 'v2');
    // A write from outside either instance (another tab) is seen too.
    values.set('demo-menu:menu:mamas-kitchen', 'v3');
    assert.equal(customerTab.getString('menu:mamas-kitchen'), 'v3');
    businessTab.remove('menu:mamas-kitchen');
    assert.equal(customerTab.getString('menu:mamas-kitchen'), undefined);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('a full localStorage keeps the page\'s own copy until a write succeeds again', async () => {
  const values = new Map();
  let full = true;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (full) throw new Error('QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  } });
  try {
    const store = (await freshStorage()).createStorage({ id: 'cart' });
    store.set('state', 'kept in memory');
    assert.equal(store.getString('state'), 'kept in memory');
    assert.equal(values.has('cart:state'), false);
    full = false;
    store.set('state', 'persisted');
    values.set('cart:state', 'changed by another tab');
    assert.equal(store.getString('state'), 'changed by another tab');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('blocked Safari storage supports writes and deletion within the session', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    const { createStorage } = await freshStorage();
    const store = createStorage({ id: 'cart' });
    assert.equal(store.getString('state'), undefined);
    store.set('state', 'value');
    assert.equal(store.getString('state'), 'value');
    store.remove('state');
    assert.equal(store.getString('state'), undefined);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('manifest icons exist and match the declared dimensions', async () => {
  const publicRoot = new URL('../apps/azglobe/public/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', publicRoot), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(icon.src.slice(1), publicRoot));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  const touchIcon = await readFile(new URL('icons/apple-touch-icon.png', publicRoot));
  assert.equal(touchIcon.readUInt32BE(16), 180);
});
