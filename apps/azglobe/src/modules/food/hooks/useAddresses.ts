import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSession } from '@app/providers/SessionProvider';
import { listAddresses } from '../services/addresses';
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

  return { uid, addresses, selected, select, refresh, isLoading: query.isLoading };
}
