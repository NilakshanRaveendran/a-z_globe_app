import { createStorage } from '@core/storage';
import { listMyOrders } from '@modules/food/services/orders';
import { listMerchants } from '@modules/food/services/merchants';
import { listActiveOffers, listPromoCodes, offerHeadline } from '@modules/food/services/promotions';
import { listOwnedRestaurants } from '@/supplier/services/restaurants';
import { listMerchantOrders } from '@/supplier/services/orders';
import { isTerminalStatus, type Order, type OrderStatus } from '@modules/food/types';

export type InboxItem = {
  id: string; kind: 'orders' | 'offers' | 'groups'; at: number; title: string; body: string;
  target: { type: 'order'; orderId: string; merchantId: string; merchantName: string; closed: boolean }
    | { type: 'offer'; merchantId: string; expires: number }
    | { type: 'group'; groupId: string };
};
const history = createStorage({ id: 'azglobe.notificationHistory' });
const prefs = createStorage({ id: 'azglobe.notificationPrefs' });
export function notificationPrefs(uid: string) {
  try { return { orders: true, offers: true, groups: true, ...JSON.parse(prefs.getString(uid) ?? '{}') }; }
  catch { return { orders: true, offers: true, groups: true }; }
}
export function readInbox(key: string): InboxItem[] {
  try { const rows = JSON.parse(history.getString(key) ?? '[]'); return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}
export function saveInbox(key: string, incoming: InboxItem[]) {
  const merged = new Map(readInbox(key).map(item => [item.id, item]));
  incoming.forEach(item => merged.set(item.id, item));
  const items = [...merged.values()].sort((a, b) => b.at - a.at).slice(0, 1000);
  history.set(key, JSON.stringify(items));
  return items;
}
const titles: Partial<Record<OrderStatus, string>> = {
  new: 'New food order', accepted: 'Order accepted', ready_for_pickup: 'Ready for pickup',
  picked_up: 'Order picked up', delivered: 'Order completed', cancelled: 'Order cancelled', refunded: 'Refund processed',
};
export function orderNotifications(orders: Order[], business: boolean): InboxItem[] {
  return orders.flatMap(order => (order.timeline?.length ? order.timeline : [{ status: order.status, at: order.createdAt }])
    .filter(event => business ? ['new', 'cancelled', 'refunded'].includes(event.status) : event.status !== 'new' && !!titles[event.status])
    .map(event => ({
      id: `food:${order.id}:${event.status}:${event.at}`, kind: 'orders' as const,
      at: event.at, title: titles[event.status]!, body: `${order.merchantName} · ${order.ref}`,
      target: { type: 'order' as const, orderId: order.id, merchantId: order.merchantId, merchantName: order.merchantName, closed: isTerminalStatus(order.status) },
    })));
}
export async function loadInbox(uid: string, business: boolean) {
  const key = `${business ? 'supplier' : 'customer'}:${uid}`;
  const preferences = notificationPrefs(uid);
  const sources: Promise<InboxItem[]>[] = [];
  if (preferences.orders) sources.push((async () => {
    const orders = business
      ? (await Promise.all((await listOwnedRestaurants(uid)).map(m => listMerchantOrders(m.id, ['new', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled', 'refunded'])))).flat()
      : await listMyOrders();
    return orderNotifications(orders, business);
  })());
  // Consumer promotions only: business accounts do not receive their own adverts.
  if (!business && preferences.offers) sources.push((async () => {
    const merchants = await listMerchants({}, 20);
    const results = await Promise.all(merchants.map(async merchant => {
      const [offers, codes] = await Promise.all([listActiveOffers(merchant.id), listPromoCodes(merchant.id)]);
      return [...new Map([...offers, ...codes].map(p => [p.id, p])).values()].map(p => ({
        id: `offer:${merchant.id}:${p.id}`, kind: 'offers' as const,
        at: p.createdAt ?? readInbox(key).find(n => n.id === `offer:${merchant.id}:${p.id}`)?.at ?? Date.now(),
        title: p.code ? `Promo code: ${p.code}` : `${merchant.name}: ${p.value}${p.type === 'percent' ? '% off' : ' rupees off'}`,
        body: `${merchant.name} · ${offerHeadline(p)}`,
        target: { type: 'offer' as const, merchantId: merchant.id, expires: p.validUntil },
      }));
    }));
    return results.flat();
  })());
  const results = await Promise.allSettled(sources);
  const incoming = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  return { items: saveInbox(key, incoming), failed: results.some(result => result.status === 'rejected') };
}
