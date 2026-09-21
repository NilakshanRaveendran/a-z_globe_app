import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
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
