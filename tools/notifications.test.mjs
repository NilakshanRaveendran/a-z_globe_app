import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source = stripTypeScriptTypes(await readFile(new URL('../apps/azglobe/src/app/notifications/inbox.ts', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const stubs = `
  const stores = new Map();
  const createStorage = ({id}) => ({ getString: key => stores.get(id + key), set: (key, value) => stores.set(id + key, value) });
  const isTerminalStatus = status => ['delivered','cancelled','refunded'].includes(status);
  const listMyOrders = async () => { throw new Error('offline'); };
  const listOwnedRestaurants = async () => [];
  const listMerchantOrders = async () => [];
  const listMerchants = async () => [];
  const listActiveOffers = async () => [];
  const listPromoCodes = async () => [];
  const offerHeadline = () => '';
`;
const inbox = await import(`data:text/javascript;base64,${Buffer.from(stubs + source).toString('base64')}`);
const order = { id:'one', ref:'001', merchantId:'shop', merchantName:'Shop', status:'delivered', createdAt:1, timeline:['new','accepted','preparing','ready_for_pickup','picked_up','delivered'].map((status, at) => ({status,at})) };
test('customers receive milestones rather than every kitchen action', () => {
  const items = inbox.orderNotifications([order], false);
  assert.deepEqual(items.map(item => item.title), ['Order accepted','Ready for pickup','Order picked up','Order completed']);
  assert.ok(items.every(item => item.target.closed));
});
test('business inbox avoids notifications for its own preparation actions', () => {
  assert.deepEqual(inbox.orderNotifications([order], true).map(item => item.title), ['New food order']);
  const cancelled = { ...order, timeline: [{status:'cancelled',at:20}], status:'cancelled' };
  assert.equal(inbox.orderNotifications([cancelled], true)[0].title, 'Order cancelled');
});
test('history retains expired or no-longer-returned items and deduplicates refreshes', () => {
  const item = {id:'promo',kind:'offers',at:1,title:'Offer',body:'Deal',target:{type:'offer',merchantId:'shop',expires:2}};
  inbox.saveInbox('customer:one', [item]);
  assert.equal(inbox.saveInbox('customer:one', [item]).length, 1);
  assert.equal(inbox.saveInbox('customer:one', [])[0].id, 'promo');
  assert.deepEqual(inbox.readInbox('supplier:one'), []);
});
test('source failure keeps saved notifications available', async () => {
  const item = {id:'group',kind:'groups',at:3,title:'Joined',body:'Group',target:{type:'group',groupId:'g'}};
  inbox.saveInbox('customer:offline', [item]);
  const result = await inbox.loadInbox('offline', false);
  assert.equal(result.failed, true);
  assert.deepEqual(result.items, [item]);
});
