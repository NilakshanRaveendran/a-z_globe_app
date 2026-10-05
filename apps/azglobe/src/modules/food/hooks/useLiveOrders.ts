import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { findActiveOrders, timeOf, watchOrder } from '../services/orders';
import { useActiveOrder } from '../store/activeOrder';
import { isTerminalStatus, type Order } from '../types';

/** Shared live collection for Home's summary and the restaurant tracking overview. */
export function useLiveOrders() {
  const ids = useActiveOrder(s => s.orderIds);
  const add = useActiveOrder(s => s.addOrderIds);
  const remove = useActiveOrder(s => s.removeOrderId);
  const reviewed = useActiveOrder(s => s.reviewPrompted);
  const focused = useIsFocused();
  const endedAt = useRef<Record<string, number>>({});
  const [byId, setById] = useState<Record<string, Order>>({});
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void findActiveOrders().then(rows => { if (live) add(rows.map(o => o.id)); }).catch(() => {});
    return () => { live = false; };
  }, [focused, add]);
  const idsKey = JSON.stringify(ids);
  useEffect(() => {
    if (!focused) return;
    let live = true;
    const tracked: string[] = JSON.parse(idsKey);
    const stops = tracked.map(id => watchOrder(id, order => {
      if (!live) return;
      if (!order) { remove(id); return; }
      setById(previous => ({ ...previous, [id]: order }));
    }));
    return () => { live = false; stops.forEach(stop => stop()); };
  }, [idsKey, focused, remove]);
  useEffect(() => {
    if (!focused) return;
    const timers = ids.flatMap(id => {
      const order = byId[id];
      if (!order || !isTerminalStatus(order.status)) return [];
      const delay = order.status !== 'delivered' ? Math.max(0, (endedAt.current[id] ??= Date.now()) + 6000 - Date.now()) : reviewed.includes(id) ? 0
        : Math.max(0, (timeOf(order, 'delivered') ?? order.createdAt) + 2 * 60 * 60 * 1000 - Date.now());
      return [setTimeout(() => remove(id), delay)];
    });
    return () => timers.forEach(clearTimeout);
  }, [ids, byId, reviewed, focused, remove]);
  return ids.map(id => byId[id]).filter((order): order is Order => !!order);
}
