import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createStorage } from '@core/storage';

const storage = createStorage({ id: 'azglobe.food.activeOrder' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => {
    storage.remove(name);
  },
};

/** How many answered review prompts are remembered. */
const REVIEWED_LIMIT = 50;

type ActiveOrderState = {
  /** Legacy first-order pointer, kept for persisted-state compatibility. */
  orderId: string | null;
  orderIds: string[];
  addOrderIds: (ids: string[]) => void;
  removeOrderId: (id: string) => void;
  setOrderId: (id: string | null) => void;
  /**
   * Delivered orders whose "How was your order?" prompt has been answered —
   * reviewed or dismissed — newest first, so it is never asked twice.
   */
  reviewPrompted: string[];
  /**
   * Answer the review prompt for a delivered order. When it is the order the
   * Home card is showing, the card goes too — its job is done.
   */
  markReviewPrompted: (orderId: string) => void;
};

export const useActiveOrder = create<ActiveOrderState>()(
  persist(
    (set) => ({
      orderId: null,
      orderIds: [],
      setOrderId: (orderId) => set({ orderId, orderIds: orderId ? [orderId] : [] }),
      addOrderIds: (ids) => set((s) => {
        const orderIds = [...new Set([...s.orderIds, ...ids])];
        return { orderIds, orderId: orderIds[0] ?? null };
      }),
      removeOrderId: (id) => set((s) => {
        const orderIds = s.orderIds.filter((x) => x !== id);
        return { orderIds, orderId: orderIds[0] ?? null };
      }),
      reviewPrompted: [],
      markReviewPrompted: (id) =>
        set((s) => ({
          reviewPrompted: [id, ...s.reviewPrompted.filter((x) => x !== id)].slice(0, REVIEWED_LIMIT),
          orderIds: s.orderIds.filter((x) => x !== id),
          orderId: s.orderIds.find((x) => x !== id) ?? null,
        })),
    }),
    {
      name: 'activeOrder',
      storage: createJSONStorage(() => mmkvStorage),
      // Only data — the setters are rebuilt on every launch.
      partialize: (s) => ({ orderId: s.orderId, orderIds: s.orderIds, reviewPrompted: s.reviewPrompted }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<ActiveOrderState> | undefined;
        return { ...current, ...saved, orderIds: saved?.orderIds ?? (saved?.orderId ? [saved.orderId] : []) };
      },
    }
  )
);

/** Whether the review prompt for this order has already been answered. */
export function useReviewPrompted(orderId: string | null | undefined): boolean {
  return useActiveOrder((s) => (orderId ? s.reviewPrompted.includes(orderId) : false));
}
