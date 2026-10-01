import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { findActiveOrder, timeOf, watchOrder } from '../services/orders';
import { useActiveOrder } from '../store/activeOrder';
import { isTerminalStatus, type Order } from '../types';

/** How long a cancelled or refunded order stays on Home before the card clears. */
const CLEAR_AFTER_MS = 6000;
/**
 * A delivered order stays on Home with its "How was your order?" prompt until
 * the customer answers it — but not forever: after this long it clears anyway.
 */
const DELIVERED_LINGER_MS = 2 * 60 * 60 * 1000;

/**
 * Live view of the user's active order.
 *
 * In Firebase mode this is the app's only realtime Firestore listener. It is
 * attached on focus and detached on blur, so a backgrounded Home screen holds
 * no open stream — which is what keeps listener count flat as the user base
 * grows. In demo mode `watchOrder` polls the shared demo store instead.
 *
 * Once the order ends the pointer is cleared and the Home card disappears on
 * its own: a cancelled or refunded one after a few seconds; a delivered one
 * once its review prompt has been answered (or a couple of hours on). The
 * timer is cleared on cleanup, and the previous order is dropped as soon as
 * the id changes, so one order can never flash in another's place (C9, C38).
 *
 * The pointer lives on the device. When there is none — a fresh install, a new
 * phone, signing in again — Home asks once per focus for the customer's latest
 * order and resumes tracking it if it is still on its way.
 */
export function useOrderTracking(): Order | null {
  const orderId = useActiveOrder((s) => s.orderId);
  const setOrderId = useActiveOrder((s) => s.setOrderId);
  const reviewPrompted = useActiveOrder((s) => s.reviewPrompted);
  const isFocused = useIsFocused();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (orderId || !isFocused) return;
    let live = true;
    findActiveOrder()
      .then((found) => {
        if (live && found) setOrderId(found.id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [orderId, isFocused, setOrderId]);

  useEffect(() => {
    // Never show the previous order under a new id.
    setOrder((prev) => (prev && prev.id === orderId ? prev : null));
    if (!orderId || !isFocused) return;

    const unsubscribe = watchOrder(orderId, (next) => {
      setOrder(next);
      // A pointer to an order that no longer exists is simply dropped.
      if (!next) setOrderId(null);
    });
    return unsubscribe;
  }, [orderId, isFocused, setOrderId]);

  // When — if ever — the card should clear itself.
  const status = order && order.id === orderId ? order.status : null;
  const answered = !!orderId && reviewPrompted.includes(orderId);
  const deliveredAt = order && status === 'delivered' ? timeOf(order, 'delivered') ?? order.createdAt : null;
  useEffect(() => {
    if (!orderId || !status || !isTerminalStatus(status)) return;
    const delay =
      status !== 'delivered'
        ? CLEAR_AFTER_MS
        : answered
          ? 0
          : Math.max(0, (deliveredAt ?? Date.now()) + DELIVERED_LINGER_MS - Date.now());
    const timer = setTimeout(() => {
      // Only clear the pointer if it still points at this order.
      if (useActiveOrder.getState().orderId === orderId) setOrderId(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [orderId, status, answered, deliveredAt, setOrderId]);

  return orderId && order?.id === orderId ? order : null;
}
