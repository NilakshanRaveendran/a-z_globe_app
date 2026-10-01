import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSession } from '@app/providers/SessionProvider';
import { listAddresses, removeAddress, saveAddress, type AddressInput } from '../services/addresses';
import { useSelectedAddressStore } from '../store/selectedAddress';
import type { Address } from '../types';

export const addressesKey = (uid: string) => ['addresses', uid] as const;

/**
 * The signed-in customer's saved addresses and the one they are ordering to.
 *
 * `selected` falls back to the first saved address when nothing was chosen (or
 * the chosen one was deleted), and is null only when the address book is empty
 * — in which case checkout asks the customer to add one rather than inventing a
 * destination.
 *
 * `save` and `remove` work in both modes (demo mode keeps the address book on
 * the device) and throw on failure, so a caller can report it rather than
 * treat a failed write as done.
 */
export function useAddresses() {
  const { user } = useSession();
  const uid = user.uid;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: addressesKey(uid),
    queryFn: () => listAddresses(uid),
    staleTime: 60_000,
  });

  const selectedId = useSelectedAddressStore((s) => s.byUser[uid]);
  const selectStore = useSelectedAddressStore((s) => s.select);

  const addresses: Address[] = query.data ?? [];
  const selected = addresses.find((a) => a.id === selectedId) ?? addresses[0] ?? null;

  const select = useCallback((id: string | null) => selectStore(uid, id), [selectStore, uid]);
  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: addressesKey(uid) }),
    [qc, uid]
  );

  /** Create or update an address, select it, and refresh the list. Returns it. */
  const save = useCallback(
    async (input: AddressInput): Promise<Address> => {
      const saved = await saveAddress(uid, input);
      selectStore(uid, saved.id);
      await qc.invalidateQueries({ queryKey: addressesKey(uid) });
      return saved;
    },
    [qc, selectStore, uid]
  );

  /**
   * Delete an address. The selection is cleared only when it was the one
   * removed (audit C38), so checkout falls back to the first remaining one.
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      await removeAddress(uid, id);
      if (useSelectedAddressStore.getState().byUser[uid] === id) selectStore(uid, null);
      await qc.invalidateQueries({ queryKey: addressesKey(uid) });
    },
    [qc, selectStore, uid]
  );

  return { uid, addresses, selected, select, refresh, save, remove, isLoading: query.isLoading };
}
