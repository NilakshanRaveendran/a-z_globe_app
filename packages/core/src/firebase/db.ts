import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  startAfter,
  onSnapshot,
  type WhereFilterOp,
  type DocumentSnapshot,
} from '@react-native-firebase/firestore';
import { getApp } from './index';

/**
 * `QueryConstraint` is not re-exported from the package index, so the constraint
 * type is derived from the builders themselves — this stays correct if the SDK
 * changes shape.
 */
type Constraint =
  | ReturnType<typeof where>
  | ReturnType<typeof orderBy>
  | ReturnType<typeof fsLimit>
  | ReturnType<typeof startAfter>;

export type QuerySpec = {
  where?: Array<[string, WhereFilterOp, unknown]>;
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
  /** Every list query is bounded — no screen ever reads a whole collection. */
  limit?: number;
  cursor?: DocumentSnapshot;
};

export function db() {
  return getFirestore(getApp());
}

/** Read one document, typed, or null if it does not exist. */
export async function readDoc<T>(path: string, id: string): Promise<T | null> {
  if (!id) return null;
  const snap = await getDoc(doc(collection(db(), path), id));
  return toDoc<T>(snap);
}

/**
 * A snapshot can arrive null when a read is denied or fails, so reading
 * `.exists()` straight off it throws inside the listener where nothing catches
 * it. Everything that turns a snapshot into a document goes through here.
 */
function toDoc<T>(snap: { exists: () => boolean; id: string; data: () => unknown } | null): T | null {
  if (!snap || typeof snap.exists !== 'function' || !snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as object) } as T;
}

/**
 * Paginated collection read. Returns the rows plus the cursor to continue from,
 * so list screens can append without re-reading what they already have.
 */
export async function readCollection<T>(
  path: string,
  spec: QuerySpec = {}
): Promise<{ rows: T[]; cursor?: DocumentSnapshot }> {
  const constraints: Constraint[] = [];
  for (const [field, op, value] of spec.where ?? []) constraints.push(where(field, op, value));
  if (spec.orderBy) constraints.push(orderBy(spec.orderBy.field, spec.orderBy.direction ?? 'asc'));
  if (spec.cursor) constraints.push(startAfter(spec.cursor));
  constraints.push(fsLimit(spec.limit ?? 20));

  const snap = await getDocs(query(collection(db(), path), ...constraints));
  return {
    rows: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
    cursor: snap.docs[snap.docs.length - 1],
  };
}

/**
 * Paginated read across every subcollection of a given name, wherever it sits —
 * e.g. every `menuItems` collection under every merchant.
 *
 * Needed because dishes live under the restaurant that serves them, so any
 * cross-restaurant view ("Popular Dishes") cannot be a plain collection read.
 * Firestore requires a collection-group index and a `/{path=**}/` read rule for
 * this; both are in firestore.indexes.json and firestore.rules.
 */
export async function readCollectionGroup<T>(
  name: string,
  spec: QuerySpec = {}
): Promise<{ rows: T[]; cursor?: DocumentSnapshot }> {
  const constraints: Constraint[] = [];
  for (const [field, op, value] of spec.where ?? []) constraints.push(where(field, op, value));
  if (spec.orderBy) constraints.push(orderBy(spec.orderBy.field, spec.orderBy.direction ?? 'asc'));
  if (spec.cursor) constraints.push(startAfter(spec.cursor));
  constraints.push(fsLimit(spec.limit ?? 20));

  const snap = await getDocs(query(collectionGroup(db(), name), ...constraints));
  return {
    rows: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
    cursor: snap.docs[snap.docs.length - 1],
  };
}

/**
 * Realtime document listener. Used for exactly one thing — the active order on
 * the Home screen — so the app holds at most one open stream at a time.
 */
export function watchDoc<T>(
  path: string,
  id: string,
  onChange: (value: T | null) => void,
  onError?: (e: Error) => void
): () => void {
  if (!id) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(collection(db(), path), id),
    (snap) => onChange(toDoc<T>(snap)),
    (error) => {
      // A listener error is terminal for that stream; surface it as "no order"
      // so the UI falls back to its empty state instead of hanging.
      onChange(null);
      onError?.(error);
    }
  );
}
