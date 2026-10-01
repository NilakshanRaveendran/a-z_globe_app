import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createStorage } from '@core/storage';

const storage = createStorage({ id: 'azglobe.food.selectedAddress' });

/**
 * Which saved address the customer is ordering to, remembered across launches.
 *
 * Keyed by uid: two people signing in on the same phone must not inherit each
 * other's delivery address. Only the id is stored — the address itself lives in
 * `customers/{uid}/addresses`, so an edit there is never shadowed by a stale
 * local copy.
 */
type SelectedAddressState = {
  byUser: Record<string, string>;
  select: (uid: string, addressId: string | null) => void;
  /** Forget every remembered choice — on sign-out, so the next person starts clean. */
  reset: () => void;
};

export const useSelectedAddressStore = create<SelectedAddressState>()(
  persist(
    (set) => ({
      byUser: {},
      reset: () => set({ byUser: {} }),
      select: (uid, addressId) =>
        set((s) => {
          const next = { ...s.byUser };
          if (addressId) next[uid] = addressId;
          else delete next[uid];
          return { byUser: next };
        }),
    }),
    {
      name: 'selectedAddress',
      storage: createJSONStorage(() => ({
        getItem: (k: string) => storage.getString(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
        removeItem: (k: string) => {
          storage.remove(k);
        },
      })),
    }
  )
);
