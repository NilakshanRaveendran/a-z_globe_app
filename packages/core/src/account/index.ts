import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '../firebase/firestore';
import { getApp, isFirebaseReady } from '../firebase';
import {
  ACCOUNT_COLLECTION,
  type AccountKind,
  type CustomerAccount,
  type SupplierAccount,
} from './types';

export * from './types';

/**
 * Which kind of account this uid holds, by looking for its profile document.
 *
 * A-Z Globe is one app for two audiences, so this is the call that decides
 * which experience a sign-in leads to — the same question `firestore.rules`
 * answers server-side, asked up front so the UI never offers something the
 * database will refuse.
 *
 * Returns null ONLY when the lookup succeeded and the uid holds neither, which
 * is the normal state for a brand-new sign-up. A failed lookup THROWS rather
 * than returning null, because the two must never be confused: treating "could
 * not check" as "has no account" would show a returning customer the sign-up
 * chooser and invite them to create a second, separate account they did not
 * want. Callers decide what to do with the failure; see SessionProvider.
 */
export async function accountKindOf(uid: string): Promise<AccountKind | null> {
  if (!isFirebaseReady() || !uid) return null;
  const db = getFirestore(getApp());
  const [customer, supplier] = await Promise.all([
    getDoc(doc(db, ACCOUNT_COLLECTION.customer, uid)),
    getDoc(doc(db, ACCOUNT_COLLECTION.supplier, uid)),
  ]);
  if (customer?.exists()) return 'customer';
  if (supplier?.exists()) return 'supplier';
  return null;
}

/**
 * Create the profile document for a newly signed-in uid, if it has none.
 *
 * Refuses to cross the line: asking for a supplier profile on a uid that
 * already holds a customer one throws rather than silently doing nothing, so
 * the mistake surfaces in development instead of turning into a confusing
 * permission denial later. The rules refuse the same write regardless — this
 * is the readable version of that refusal.
 */
export async function ensureAccount(
  kind: AccountKind,
  uid: string,
  profile: Partial<CustomerAccount & SupplierAccount>
): Promise<void> {
  if (!isFirebaseReady() || !uid) return;
  const existing = await accountKindOf(uid);
  if (existing && existing !== kind) {
    throw new Error(
      `uid ${uid} already holds a ${existing} account. ` +
        `Customer and supplier accounts are separate A-Z Globe accounts and must ` +
        `sign in as separate Firebase users.`
    );
  }
  await setDoc(
    doc(getFirestore(getApp()), ACCOUNT_COLLECTION[kind], uid),
    { ...profile, ...(existing ? {} : { createdAt: serverTimestamp() }) },
    { merge: true }
  );
}

/** The editable part of a profile document: a person's or a business's contact details. */
export type AccountProfile = { name: string; email: string; phone: string };

/**
 * Read this account's own profile document — `customers/{uid}` (the person)
 * or `suppliers/{uid}` (the business: `name` is the business name). Null with
 * no Firebase project, or when the document is missing.
 */
export async function readAccountProfile(kind: AccountKind, uid: string): Promise<AccountProfile | null> {
  if (!isFirebaseReady() || !uid) return null;
  const snap = await getDoc(doc(getFirestore(getApp()), ACCOUNT_COLLECTION[kind], uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<CustomerAccount & SupplierAccount>;
  return { name: data.name ?? '', email: data.email ?? '', phone: data.phone ?? '' };
}

/** Save contact details onto the account's own profile document (merged). */
export async function saveAccountProfile(
  kind: AccountKind,
  uid: string,
  profile: Partial<AccountProfile>
): Promise<void> {
  if (!isFirebaseReady() || !uid) return;
  const clean = Object.fromEntries(
    Object.entries(profile).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])
  );
  await setDoc(doc(getFirestore(getApp()), ACCOUNT_COLLECTION[kind], uid), clean, { merge: true });
}
