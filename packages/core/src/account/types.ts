/**
 * The two kinds of A-Z Globe account.
 *
 * A person and a business are never the same Firebase user. Someone who orders
 * dinner on A-Z Globe and also runs a restaurant on it holds TWO accounts, with
 * two uids, two profile documents and two sets of permissions:
 *
 *     customers/{uid}   ordering food, and later cabs, cleaning, hotels…
 *     suppliers/{uid}   operating a business: menus, orders, offers
 *
 * Keeping them apart is not bookkeeping. It means a restaurant owner's staff
 * can be given the supplier account without also being handed that person's
 * home address, payment methods and order history; it means signing out of the
 * business does not sign you out of your dinner; and it means a supplier
 * account can later be transferred or shared without dragging a personal
 * identity along with it.
 *
 * Nothing in this file is food-specific on purpose. A supplier account is the
 * account that will own a hotel or a cab fleet too, so it lives in core rather
 * than in `modules/food`.
 *
 * `firestore.rules` enforces all of this server-side — see the header there.
 */

/** Which kind of account a signed-in uid holds. Never both. */
export type AccountKind = 'customer' | 'supplier';

/** `customers/{uid}` — a person using A-Z Globe. */
export type CustomerAccount = {
  uid: string;
  name: string;
  phone: string | null;
  email?: string | null;
  photoUrl?: string | null;
  /**
   * The order currently being tracked on the Home screen, so that card is one
   * cheap document read instead of a query. Maintained outside the client;
   * the rules refuse any client write to it.
   */
  activeOrderId?: string | null;
  createdAt?: number;
};

/**
 * `suppliers/{uid}` — a business account.
 *
 * This is the account that OWNS things. Every merchant document points at a
 * supplier uid via `Merchant.supplierId`, and every merchant-side permission
 * in `firestore.rules` is keyed on that.
 */
export type SupplierAccount = {
  uid: string;
  /** The legal or trading name of the business, not of the person. */
  name: string;
  phone: string | null;
  email?: string | null;
  /**
   * Businesses this account operates. One supplier account can run several —
   * two branches of the same restaurant, or a restaurant and a hotel once
   * other modules land. Maintained outside the client; rules refuse client
   * writes so a supplier cannot grant itself a business it does not own.
   */
  merchantIds?: string[];
  createdAt?: number;
};

/**
 * `accountLinks/{customerUid}_{supplierUid}` — "these two accounts are the
 * same person".
 *
 * Purely a convenience: it lets the apps offer account switching and prefill
 * contact details. It confers NO permission whatsoever — no rule in
 * `firestore.rules` reads it, which is what makes it safe to expose later
 * without widening anyone's access. Both sides must confirm, because an
 * unconfirmed claim to be somebody else's business would be misleading even
 * where it is harmless.
 *
 * A customer may link to many suppliers, and a supplier to many customers (a
 * business with more than one owner).
 */
export type AccountLink = {
  customerUid: string;
  supplierUid: string;
  /** Uids that have agreed to the link; both are present once confirmed. */
  confirmedBy: string[];
  status: 'pending' | 'confirmed';
  createdAt?: number;
};

export const accountLinkId = (customerUid: string, supplierUid: string) =>
  `${customerUid}_${supplierUid}`;

/** Firestore collection names, so no caller has to spell them. */
export const ACCOUNT_COLLECTION: Record<AccountKind, string> = {
  customer: 'customers',
  supplier: 'suppliers',
};
