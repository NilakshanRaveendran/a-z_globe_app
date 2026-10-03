import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = stripTypeScriptTypes(await readFile(new URL('../apps/azglobe/src/supplier/services/orderSteps.ts', import.meta.url), 'utf8'));
const { nextStep, stageTransitions, businessStage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

for (const orderType of ['delivery', 'pickup']) {
  test(`${orderType}: exactly three staff actions finish an order through legal transitions`, () => {
    let status = 'new';
    const actions = [];
    const timeline = [status];
    for (let i = 0; i < 3; i++) {
      const step = nextStep(status, orderType);
      assert.ok(step);
      actions.push(step.label);
      timeline.push(...stageTransitions({ status, orderType }, step.to));
      status = step.to;
    }
    assert.equal(status, 'delivered');
    assert.equal(nextStep(status, orderType), null);
    assert.deepEqual(actions, orderType === 'pickup'
      ? ['Accept Order', 'Mark as Ready', 'Mark as Collected']
      : ['Accept Order', 'Mark as Picked Up', 'Mark as Delivered']);
    assert.deepEqual(timeline, ['new', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered']);
  });

  test(`${orderType}: existing orders and partially completed actions resume without repeating transitions`, () => {
    for (const status of ['accepted', 'preparing', 'ready_for_pickup', 'picked_up']) {
      const step = nextStep(status, orderType);
      const path = stageTransitions({ status, orderType }, step.to);
      assert.ok(path.length);
      assert.equal(path.includes(status), false);
      assert.equal(path.at(-1), step.to);
    }
    for (const status of ['delivered', 'cancelled', 'refunded']) {
      assert.equal(nextStep(status, orderType), null);
      assert.throws(() => stageTransitions({ status, orderType }, 'accepted'));
    }
    assert.throws(() => stageTransitions({ status: 'new', orderType }, 'delivered'));
  });
}

test('filters group intermediate kitchen statuses and distinguish takeaway readiness', () => {
  for (const status of ['new', 'accepted', 'preparing']) {
    assert.equal(businessStage({ status, orderType: 'delivery' }), 'restaurant');
    assert.equal(businessStage({ status, orderType: 'pickup' }), 'restaurant');
  }
  assert.equal(businessStage({ status: 'ready_for_pickup', orderType: 'delivery' }), 'restaurant');
  assert.equal(businessStage({ status: 'ready_for_pickup', orderType: 'pickup' }), 'pickup');
  assert.equal(businessStage({ status: 'picked_up' }), 'pickup');
  assert.equal(businessStage({ status: 'delivered' }), 'completed');
  assert.equal(businessStage({ status: 'cancelled' }), null);
  assert.equal(businessStage({ status: 'refunded' }), null);
});
