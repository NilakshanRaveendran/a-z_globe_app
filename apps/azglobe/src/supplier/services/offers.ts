import { formatMoney } from '@core/utils/currency';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  increment,
  setDoc,
  updateDoc,
} from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import type { Promotion } from '@modules/food/types';
import { discountLabel, isRunningOffer, scopeLabel } from '@modules/food/services/promotions';
import {
  editDemoRestaurant,
  findDemoRestaurant,
  readDemoOffers,
  writeDemoOffers,
} from '@modules/food/services/demoCatalogue';

/**
 * A restaurant's offers — `promotions/{id}` with this restaurant's `merchantId`
 * and no `code`. `firestore.rules#validOffer` checks every write; the shape
 * below is exactly what it accepts.
 *
 * The restaurant document mirrors the running offer as `offerLabel`, which is
 * what the customer catalogue already shows on the restaurant tiles — so an
 * offer appears to customers the moment it is switched on, with no extra read
 * per tile.
 *
 * Optional numbers (`minOrder`, `usageLimit`) are OMITTED when unset — never
 * written as null. The order rules read `p.minOrder` as a number whenever the
 * field exists, so a stored null made every order at the restaurant fail.
 */

const PROMOTIONS = 'promotions';
const MERCHANTS = 'merchants';

export type OfferDraft = Pick<
  Promotion,
  'type' | 'value' | 'appliesTo' | 'itemIds' | 'minOrder' | 'validUntil' | 'usageLimit' | 'look'
>;

const db = () => getFirestore(getApp());

// ── Validation ────────────────────────────────────────────────────────────

export type OfferDraftErrors = Partial<Record<'value' | 'itemIds' | 'minOrder' | 'validUntil' | 'usageLimit', string>>;

/**
 * What is wrong with a draft, per field — empty when it can be saved. The
 * editor shows these inline; create/update refuse a draft that has any.
 * Mirrors `firestore.rules#validOffer`, plus "Valid Until" in the future.
 */
export function offerDraftErrors(
  draft: Partial<OfferDraft>,
  now = Date.now()
): OfferDraftErrors {
  const errors: OfferDraftErrors = {};
  const value = draft.value ?? NaN;
  if (draft.type === 'fixed') {
    if (Number.isNaN(value)) errors.value = 'Enter the discount amount.';
    else if (!(value > 0)) errors.value = 'The discount must be more than Rs. 0.';
  } else if (Number.isNaN(value)) {
    errors.value = 'Enter the discount percentage.';
  } else if (!(value >= 1 && value <= 100)) {
    errors.value = 'Enter a percentage from 1 to 100.';
  }
  if (draft.appliesTo === 'items' && !draft.itemIds?.length) {
    errors.itemIds = 'Select at least one item.';
  }
  if (draft.minOrder != null && !(draft.minOrder >= 0)) {
    errors.minOrder = 'Enter a valid amount, or leave it blank.';
  }
  // Rs. 500 off a Rs. 500 minimum order makes every qualifying order free.
  if (!errors.value && draft.type === 'fixed' && draft.minOrder && value >= draft.minOrder) {
    errors.value = `A fixed discount must be less than the minimum order (${formatMoney(draft.minOrder)}), or those orders would be free.`;
  }
  if (draft.validUntil == null || Number.isNaN(draft.validUntil)) {
    errors.validUntil = 'Choose the last day the offer runs.';
  } else if (draft.validUntil <= now) {
    errors.validUntil = 'Choose a date in the future.';
  }
  if (draft.usageLimit != null && !(Number.isInteger(draft.usageLimit) && draft.usageLimit >= 1)) {
    errors.usageLimit = 'Enter 1 or more, or leave it blank for no limit.';
  }
  return errors;
}

function assertValid(draft: OfferDraft): void {
  const first = Object.values(offerDraftErrors(draft))[0];
  if (first) throw new Error(first);
}

/** The draft as stored. Unset optional numbers are left out, not nulled. */
function fields(draft: OfferDraft) {
  const out: Omit<Promotion, 'id'> = {
    type: draft.type,
    value: draft.value,
    appliesTo: draft.appliesTo ?? 'all',
    itemIds: draft.appliesTo === 'items' ? (draft.itemIds ?? []) : [],
    validUntil: draft.validUntil,
    look: draft.look,
  };
  // 0 means "no minimum" to both the cart and the rules — store nothing.
  if (draft.minOrder != null && draft.minOrder > 0) out.minOrder = draft.minOrder;
  if (draft.usageLimit != null) out.usageLimit = draft.usageLimit;
  return out;
}

// ── Demo mode ─────────────────────────────────────────────────────────────
//
// Without Firebase the offers live in the shared demo catalogue, which the
// customer cart reads too (`listActiveOffers`), so an offer switched on here
// is applied to the customer's cart. Only the two restaurants the demo
// business owns start with offers; a new restaurant starts with none (S4).

function demoOffers(merchantId: string): Promotion[] {
  return readDemoOffers(merchantId);
}

function saveDemoOffers(merchantId: string, offers: Promotion[]): void {
  writeDemoOffers(merchantId, offers);
  syncDemoOfferLabel(merchantId, offers);
}

/** The demo twin of `syncOfferLabel` — keeps the customer tiles truthful. */
function syncDemoOfferLabel(merchantId: string, offers: Promotion[]): void {
  const restaurant = findDemoRestaurant(merchantId);
  if (!restaurant) return;
  const now = Date.now();
  const running = [...offers].sort(newestFirst).find((p) => isRunningOffer(p, now));
  const offerLabel = running ? offerRibbon(running) : undefined;
  // An undefined label is dropped when the store is serialised — i.e. cleared.
  if (restaurant.offerLabel !== offerLabel) editDemoRestaurant(merchantId, { offerLabel });
}

function editDemoOffer(offer: Promotion, edit: (current: Promotion) => Promotion | null): void {
  const merchantId = offer.merchantId ?? '';
  const offers = demoOffers(merchantId);
  if (!offers.some((o) => o.id === offer.id)) throw new Error('Offer not found.');
  saveDemoOffers(
    merchantId,
    offers.flatMap((o) => {
      if (o.id !== offer.id) return [o];
      const next = edit(o);
      return next ? [next] : [];
    })
  );
}

// ── Reads & writes ────────────────────────────────────────────────────────

const newestFirst = (a: Promotion, b: Promotion) => (b.createdAt ?? 0) - (a.createdAt ?? 0);

/** Every offer for one restaurant, newest first. */
export async function listOffers(merchantId: string): Promise<Promotion[]> {
  if (!merchantId) return [];
  if (!isFirebaseReady()) return demoOffers(merchantId).sort(newestFirst);
  const { rows } = await readCollection<Promotion>(PROMOTIONS, {
    where: [['merchantId', '==', merchantId]],
    limit: 50,
  });
  return rows.filter((p) => !p.code).sort(newestFirst);
}

/** Create an offer, switched on. Returns its id. */
export async function createOffer(merchantId: string, draft: OfferDraft): Promise<string> {
  if (!merchantId) throw new Error('A restaurant is required.');
  assertValid(draft);
  const offer = {
    merchantId,
    ...fields(draft),
    active: true,
    usedCount: 0,
    createdAt: Date.now(),
  };

  if (!isFirebaseReady()) {
    const id = `offer-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    saveDemoOffers(merchantId, [{ ...offer, id }, ...demoOffers(merchantId)]);
    return id;
  }

  const ref = doc(collection(db(), PROMOTIONS));
  await setDoc(ref, offer);
  await syncOfferLabel(merchantId);
  return ref.id;
}

export async function updateOffer(offer: Promotion, draft: OfferDraft): Promise<void> {
  if (!offer.merchantId) return;
  assertValid(draft);
  const next = fields(draft);

  if (!isFirebaseReady()) {
    editDemoOffer(offer, ({ minOrder: _minOrder, usageLimit: _usageLimit, ...current }) => ({
      ...current,
      ...next,
    }));
    return;
  }

  // A cleared optional field is removed, so a stale null (or an old limit)
  // never survives an edit.
  await updateDoc(doc(db(), PROMOTIONS, offer.id), {
    ...next,
    minOrder: next.minOrder ?? deleteField(),
    usageLimit: next.usageLimit ?? deleteField(),
  });
  await syncOfferLabel(offer.merchantId);
}

export async function setOfferActive(offer: Promotion, active: boolean): Promise<void> {
  if (!offer.merchantId) return;
  if (!isFirebaseReady()) {
    editDemoOffer(offer, (current) => ({ ...current, active }));
    return;
  }
  await updateDoc(doc(db(), PROMOTIONS, offer.id), { active });
  await syncOfferLabel(offer.merchantId);
}

export async function deleteOffer(offer: Promotion): Promise<void> {
  if (!offer.merchantId) return;
  if (!isFirebaseReady()) {
    editDemoOffer(offer, () => null);
    return;
  }
  await deleteDoc(doc(db(), PROMOTIONS, offer.id));
  await syncOfferLabel(offer.merchantId);
}

/**
 * Count a use of the promotion an accepted order carried.
 *
 * Only a promotion this restaurant owns can be counted — a platform promo code
 * is refused by the rules — so a failure here is expected for those and never
 * blocks accepting the order.
 *
 * Demo mode needs `merchantId` to find the offer in the restaurant's store; a
 * promo code (not in that store) is simply not counted, as in Firebase.
 */
export async function countOfferUse(
  promoId: string | undefined | null,
  merchantId?: string
): Promise<void> {
  if (!promoId) return;
  if (!isFirebaseReady()) {
    if (!merchantId) return;
    const offers = demoOffers(merchantId);
    if (!offers.some((o) => o.id === promoId)) return;
    saveDemoOffers(
      merchantId,
      offers.map((o) => (o.id === promoId ? { ...o, usedCount: (o.usedCount ?? 0) + 1 } : o))
    );
    return;
  }
  await updateDoc(doc(db(), PROMOTIONS, promoId), { usedCount: increment(1) }).catch(() => {});
}

/**
 * Point the restaurant's `offerLabel` at its newest running offer, or clear it
 * when none is running.
 */
async function syncOfferLabel(merchantId: string): Promise<void> {
  const now = Date.now();
  const running = (await listOffers(merchantId)).find((p) => isRunningOffer(p, now));
  await updateDoc(doc(db(), MERCHANTS, merchantId), {
    offerLabel: running ? offerRibbon(running) : deleteField(),
  });
}

/**
 * The ribbon on the restaurant's tiles — "20% OFF on All items". Kept to the
 * discount and its scope: the tile ribbon is one short line, and the full
 * terms are on the restaurant page's offer card.
 */
export function offerRibbon(p: Pick<Promotion, 'type' | 'value' | 'appliesTo'>): string {
  return `${discountLabel(p)} ${scopeLabel(p)}`;
}
