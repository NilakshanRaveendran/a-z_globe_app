import type { Order, OrderStatus } from '@modules/food/types';

/** Three staff actions matching the customer's three milestones. */
export function nextStep(
  status: OrderStatus,
  orderType: Order['orderType'] = 'delivery'
): { to: OrderStatus; label: string } | null {
  if (status === 'new') return { to: 'accepted', label: 'Accept Order' };
  if (orderType === 'pickup') {
    if (status === 'accepted' || status === 'preparing') return { to: 'ready_for_pickup', label: 'Mark as Ready' };
    if (status === 'ready_for_pickup' || status === 'picked_up') return { to: 'delivered', label: 'Mark as Collected' };
  } else {
    if (status === 'accepted' || status === 'preparing' || status === 'ready_for_pickup') {
      return { to: 'picked_up', label: 'Mark as Picked Up' };
    }
    if (status === 'picked_up') return { to: 'delivered', label: 'Mark as Delivered' };
  }
  return null;
}

const LIFECYCLE: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'delivered'];

/** Preserve the database's legal transitions and audit trail behind one tap. */
export function stageTransitions(order: Pick<Order, 'status' | 'orderType'>, to: OrderStatus): OrderStatus[] {
  if (nextStep(order.status, order.orderType)?.to !== to) throw new Error('This order has already moved on. Refresh and try again.');
  return LIFECYCLE.slice(LIFECYCLE.indexOf(order.status) + 1, LIFECYCLE.indexOf(to) + 1);
}

export function businessStage(order: Pick<Order, 'status' | 'orderType'>): 'restaurant' | 'pickup' | 'completed' | null {
  if (order.status === 'cancelled' || order.status === 'refunded') return null;
  if (order.status === 'delivered') return 'completed';
  if (order.status === 'picked_up' || (order.orderType === 'pickup' && order.status === 'ready_for_pickup')) return 'pickup';
  return 'restaurant';
}
