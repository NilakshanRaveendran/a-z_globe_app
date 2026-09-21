import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { findActiveOrder, watchOrder } from '../services/orders';
import { useActiveOrder } from '../store/activeOrder';
import type { Order } from '../types';

/**
 * Live view of the user's active order.
 *
 * This is the app's only realtime Firestore listener. It is attached on focus
 * and detached on blur, so a backgrounded Home screen holds no open stream —
 * which is what keeps listener count flat as the user base grows.
 *
 * Once the order reaches a terminal state the pointer is cleared, so the Home
 * card disappears on its own.
 *
 * The pointer lives on the device. When there is none — a fresh install, a new
 * phone, signing in again — Home asks Firestore once per focus for the
 * customer's latest order and resumes tracking it if it is still on its way.
 */
export function useOrderTracking(): Order | null {
  const orderId = useActiveOrder((s) => s.orderId);
  const setOrderId = useActiveOrder((s) => s.setOrderId);
  const isFocused = useIsFocused();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (orderId || !isFocused) return;
    let live = true;
    findActiveOrder()
      .then((found) => live && found && setOrderId(found.id))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [orderId, isFocused, setOrderId]);

  useEffect(() => {
    if (!orderId || !isFocused) return;

    const unsubscribe = watchOrder(orderId, (next) => {
      setOrder(next);
      if (!next || next.status === 'delivered' || next.status === 'cancelled') {
        // Give the user a moment to see the final state before it clears.
        setTimeout(() => setOrderId(null), 5000);
      }
    });

    return unsubscribe;
  }, [orderId, isFocused, setOrderId]);

  return orderId ? order : null;
}
