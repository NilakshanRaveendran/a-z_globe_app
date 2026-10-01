import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = stripTypeScriptTypes(
  await readFile(new URL('../apps/azglobe/src/modules/food/services/deliveryPricing.ts', import.meta.url), 'utf8'),
);
const { distanceKm, feeAtDistance, quoteDelivery, feeSchedule, usesDistance } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

// Mama's Kitchen, Trincomalee, and points due north of it (1° lat ≈ 111.19 km).
const shop = { lat: 8.5874, lng: 81.2152 };
const north = (km) => ({ lat: shop.lat + km / 111.19493, lng: shop.lng });
const merchant = (rules, extra = {}) => ({ deliveryFee: 0, geo: { ...shop, geohash: 'x' }, deliveryRules: rules, ...extra });
const perKm = { pricing: 'distance', freeKm: 1, perKm: 50, maxKm: 5 };

test('distance is straight-line km', () => {
  assert.ok(Math.abs(distanceKm(shop, north(3)) - 3) < 0.01);
  // Trincomalee → Jaffna is roughly 180 km as the crow flies.
  const km = distanceKm(shop, { lat: 9.6615, lng: 80.0255 });
  assert.ok(km > 170 && km < 190, String(km));
});

test('free inside the free zone, then per started km beyond it', () => {
  assert.equal(feeAtDistance(perKm, 0, 0.4), 0);
  assert.equal(feeAtDistance(perKm, 0, 1), 0);
  assert.equal(feeAtDistance(perKm, 0, 1.2), 50);
  assert.equal(feeAtDistance(perKm, 0, 2), 50);
  assert.equal(feeAtDistance(perKm, 0, 2.01), 100);
  assert.equal(feeAtDistance(perKm, 100, 4.5), 100 + 4 * 50);
});

test('quote: zone, radius, order waiver, missing pins', () => {
  const m = merchant(perKm);
  assert.deepEqual(quoteDelivery(m, { geo: north(0.5) }, 500).fee, 0);
  assert.equal(quoteDelivery(m, { geo: north(0.5) }, 500).free, 'zone');
  assert.equal(quoteDelivery(m, { geo: north(3.4) }, 500).fee, 150);
  const far = quoteDelivery(m, { geo: north(6) }, 500);
  assert.equal(far.ok, false);
  assert.equal(far.reason, 'outOfRange');
  assert.equal(quoteDelivery(m, {}, 500).reason, 'needsPin');
  assert.equal(quoteDelivery(m, null, 500).reason, 'needsAddress');
  const waived = quoteDelivery(merchant(perKm, { freeDeliveryOver: 2000 }), { geo: north(4) }, 2500);
  assert.deepEqual([waived.ok, waived.fee, waived.free], [true, 0, 'order']);
  // Out of range stays out of range, however big the order.
  assert.equal(quoteDelivery(merchant(perKm, { freeDeliveryOver: 2000 }), { geo: north(9) }, 9000).ok, false);
});

test('flat fee with only a radius', () => {
  const m = merchant({ pricing: 'flat', freeKm: 0, perKm: 0, maxKm: 5 }, { deliveryFee: 120 });
  assert.equal(quoteDelivery(m, { geo: north(4.9) }, 500).fee, 120);
  assert.equal(quoteDelivery(m, { geo: north(5.1) }, 500).reason, 'outOfRange');
});

test('no rules, or no restaurant pin, keeps the old flat fee anywhere', () => {
  assert.equal(quoteDelivery({ deliveryFee: 80 }, null, 100).fee, 80);
  const unpinned = { deliveryFee: 80, deliveryRules: perKm };
  assert.equal(usesDistance(unpinned), false);
  assert.equal(quoteDelivery(unpinned, {}, 100).fee, 80);
});

test('fee schedule for the preview', () => {
  assert.deepEqual(
    feeSchedule(perKm, 0).map((r) => [r.fromKm, r.toKm, r.fee]),
    [[0, 1, 0], [1, 2, 50], [2, 3, 100], [3, 4, 150], [4, 5, 200]],
  );
  assert.deepEqual(
    feeSchedule({ pricing: 'distance', freeKm: 0, perKm: 40, maxKm: 2.5 }, 60).map((r) => [r.fromKm, r.toKm, r.fee]),
    [[0, 1, 100], [1, 2, 140], [2, 2.5, 180]],
  );
});
