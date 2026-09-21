import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'azglobe.food.activeOrder' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => {
    storage.remove(name);
  },
};

type ActiveOrderState = {
  /**
   * Pointer to the order the Home screen tracks live. In a Firebase build this
   * mirrors `users/{uid}.activeOrderId`, which a Cloud Function maintains; it is
   * persisted so the card survives a cold start.
   */
  orderId: string | null;
  setOrderId: (id: string | null) => void;
};

export const useActiveOrder = create<ActiveOrderState>()(
  persist(
    (set) => ({
      orderId: null,
      setOrderId: (orderId) => set({ orderId }),
    }),
    { name: 'activeOrder', storage: createJSONStorage(() => mmkvStorage) }
  )
);
