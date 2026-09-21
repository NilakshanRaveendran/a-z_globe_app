import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import { savedAddresses as designAddresses } from '../data/addresses';
import type { Address } from '../types';

/**
 * The customer's address book — `customers/{uid}/addresses`.
 *
 * `firestore.rules` lets only the owning customer read or write this
 * subcollection. A restaurant never reads it; it receives the one address an
 * order is for, snapshotted onto the order at checkout (see `placeOrder`).
 *
 * Every address here was entered by the customer in the app. The design-mode
 * fixtures below are used ONLY when no Firebase project is configured, so UI
 * work still renders the Figma content; they never appear alongside real data.
 */

const path = (uid: string) => `customers/${uid}/addresses`;

export async function listAddresses(uid: string): Promise<Address[]> {
  if (!isFirebaseReady()) return designAddresses.map(fromDesign);
  if (!uid) return [];
  const { rows } = await readCollection<Address>(path(uid), { limit: 20 });
  return rows;
}

export type AddressInput = Omit<Address, 'id'> & { id?: string };

/** Create or update an address; returns it with its id. */
export async function saveAddress(uid: string, input: AddressInput): Promise<Address> {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured.');
  const ref = input.id
    ? doc(collection(getFirestore(getApp()), path(uid)), input.id)
    : doc(collection(getFirestore(getApp()), path(uid)));
  const { id: _id, ...fields } = input;
  const clean = withoutUndefined(fields);
  await setDoc(ref, { ...clean, updatedAt: serverTimestamp() }, { merge: false });
  return { id: ref.id, ...(clean as Omit<Address, 'id'>) };
}

export async function removeAddress(uid: string, id: string): Promise<void> {
  if (!isFirebaseReady()) return;
  await deleteDoc(doc(collection(getFirestore(getApp()), path(uid)), id));
}

/** "Home" / "Work", or the street for an "Other" address. */
export function addressTitle(a: Pick<Address, 'label' | 'line1'>): string {
  return a.label === 'Other' ? a.line1 : a.label;
}

/** The full street line shown under the title. */
export function addressSubtitle(a: Pick<Address, 'line1' | 'city'>): string {
  return [a.line1, a.city].filter(Boolean).join(', ');
}

/**
 * The address as it is stored on an order: exactly the fields a restaurant or
 * rider needs, with no `undefined` values — Firestore refuses a document that
 * contains one, which would fail the whole order write.
 */
export function orderSnapshot(a: Address): Address {
  // Drop the address book's own bookkeeping (a Firestore Timestamp) — the
  // order only carries where to deliver.
  const { updatedAt: _updatedAt, ...rest } = a as Address & { updatedAt?: unknown };
  return withoutUndefined(rest) as Address;
}

function withoutUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function fromDesign(d: (typeof designAddresses)[number]): Address {
  return {
    id: d.id,
    label: d.label,
    line1: d.label === 'Other' ? d.title : d.subtitle,
    city: d.label === 'Other' ? d.subtitle : '',
    buildingType: 'house',
    dropoffOption: 'door',
  };
}
