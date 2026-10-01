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
  /**
   * Pointer to the order the Home screen tracks live. In a Firebase build this
   * mirrors `users/{uid}.activeOrderId`, which a Cloud Function maintains; it is
   * persisted so the card survives a cold start.
   */
  orderId: string | null;
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
      setOrderId: (orderId) => set({ orderId }),
      reviewPrompted: [],
      markReviewPrompted: (id) =>
        set((s) => ({
          reviewPrompted: [id, ...s.reviewPrompted.filter((x) => x !== id)].slice(0, REVIEWED_LIMIT),
          orderId: s.orderId === id ? null : s.orderId,
        })),
    }),
    {
      name: 'activeOrder',
      storage: createJSONStorage(() => mmkvStorage),
      // Only data — the setters are rebuilt on every launch.
      partialize: (s) => ({ orderId: s.orderId, reviewPrompted: s.reviewPrompted }),
    }
  )
);

/** Whether the review prompt for this order has already been answered. */
export function useReviewPrompted(orderId: string | null | undefined): boolean {
  return useActiveOrder((s) => (orderId ? s.reviewPrompted.includes(orderId) : false));
}
