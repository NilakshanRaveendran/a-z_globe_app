import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import { createStorage } from '@core/storage';
import { savedAddresses as designAddresses } from '../data/addresses';
import type { Address } from '../types';

/**
 * The customer's address book — `customers/{uid}/addresses`.
 *
 * `firestore.rules` lets only the owning customer read or write this
 * subcollection. A restaurant never reads it; it receives the one address an
 * order is for, snapshotted onto the order at checkout (see `placeOrder`).
 *
 * Every address here was entered by the customer in the app. Without a
 * Firebase project the address book lives on the device instead (audit C5),
 * starting from the Figma addresses so UI work still renders the design; it
 * never appears alongside real data.
 */

const path = (uid: string) => `customers/${uid}/addresses`;

/** The most addresses one account keeps — the same bound the Firestore read uses. */
const MAX_ADDRESSES = 20;

export async function listAddresses(uid: string): Promise<Address[]> {
  if (!isFirebaseReady()) return demoAddresses(uid);
  if (!uid) return [];
  const { rows } = await readCollection<Address>(path(uid), { limit: MAX_ADDRESSES });
  return rows;
}

export type AddressInput = Omit<Address, 'id'> & { id?: string };

/** Create or update an address; returns it with its id. */
export async function saveAddress(uid: string, input: AddressInput): Promise<Address> {
  if (!isFirebaseReady()) return saveDemoAddress(uid, input);
  const ref = input.id
    ? doc(collection(getFirestore(getApp()), path(uid)), input.id)
    : doc(collection(getFirestore(getApp()), path(uid)));
  const { id: _id, ...fields } = input;
  const clean = withoutUndefined(fields);
  await setDoc(ref, { ...clean, updatedAt: serverTimestamp() }, { merge: false });
  return { id: ref.id, ...(clean as Omit<Address, 'id'>) };
}

export async function removeAddress(uid: string, id: string): Promise<void> {
  if (!isFirebaseReady()) {
    writeDemoAddresses(uid, demoAddresses(uid).filter((a) => a.id !== id));
    return;
  }
  await deleteDoc(doc(collection(getFirestore(getApp()), path(uid)), id));
}

/** "Home" / "Work", or the street for an "Other" address. */
export function addressTitle(a: Pick<Address, 'label' | 'line1'>): string {
  return a.label === 'Other' ? a.line1 : a.label;
}

/**
 * The line under the title. An "Other" address is titled with its street, so
 * it shows just the city — "241 Maradana Rd" / "Colombo" (Figma 269:1496,
 * audit C37). Home and Work show the full street line.
 */
export function addressSubtitle(a: Pick<Address, 'line1' | 'city'> & { label?: Address['label'] }): string {
  if (a.label === 'Other' && a.city?.trim()) return a.city.trim();
  return addressLine(a);
}

/**
 * The full street line — "241 Maradana Rd, Colombo". Use it wherever the
 * address is shown without its title (a restaurant's order card, search).
 */
export function addressLine(a: Pick<Address, 'line1' | 'city'>): string {
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

// ── Demo mode ──────────────────────────────────────────────────────────────

const demoStorage = createStorage({ id: 'azglobe-demo-addresses' });
const demoKey = (uid: string) => `addresses:${uid || 'guest'}`;

/** This device's address book for `uid`, starting from the Figma addresses. */
function demoAddresses(uid: string): Address[] {
  const raw = demoStorage.getString(demoKey(uid));
  if (raw) {
    try {
      const saved = JSON.parse(raw) as Address[];
      if (Array.isArray(saved)) return saved;
    } catch {
      // Unreadable — start again from the design addresses.
    }
  }
  return designAddresses.map(fromDesign);
}

function writeDemoAddresses(uid: string, addresses: Address[]): void {
  demoStorage.set(demoKey(uid), JSON.stringify(addresses));
}

function saveDemoAddress(uid: string, input: AddressInput): Address {
  const { id: existingId, ...fields } = input;
  const current = demoAddresses(uid);
  const id = existingId || `address-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  if (!existingId && current.length >= MAX_ADDRESSES) {
    throw new Error(`You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`);
  }
  const address = { id, ...(withoutUndefined(fields) as Omit<Address, 'id'>) };
  const exists = current.some((a) => a.id === id);
  writeDemoAddresses(uid, exists ? current.map((a) => (a.id === id ? address : a)) : [...current, address]);
  return address;
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
