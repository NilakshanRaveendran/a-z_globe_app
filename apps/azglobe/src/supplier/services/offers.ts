import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  increment,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import type { Promotion } from '@modules/food/types';
import { offerHeadline } from '@modules/food/services/promotions';

/**
 * A restaurant's offers — `promotions/{id}` with this restaurant's `merchantId`
 * and no `code`. `firestore.rules#validOffer` checks every write; the shape
 * below is exactly what it accepts.
 *
 * The restaurant document mirrors the running offer as `offerLabel`, which is
 * what the customer catalogue already shows on the restaurant tiles — so an
 * offer appears to customers the moment it is switched on, with no extra read
 * per tile.
 */

const PROMOTIONS = 'promotions';
const MERCHANTS = 'merchants';

export type OfferDraft = Pick<
  Promotion,
  'type' | 'value' | 'appliesTo' | 'itemIds' | 'minOrder' | 'validUntil' | 'usageLimit' | 'look'
>;

const db = () => getFirestore(getApp());

/** Every offer for one restaurant, newest first. */
export async function listOffers(merchantId: string): Promise<Promotion[]> {
  if (!isFirebaseReady() || !merchantId) return [];
  const { rows } = await readCollection<Promotion>(PROMOTIONS, {
    where: [['merchantId', '==', merchantId]],
    limit: 50,
  });
  return rows.filter((p) => !p.code).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

function fields(draft: OfferDraft) {
  return {
    type: draft.type,
    value: draft.value,
    appliesTo: draft.appliesTo ?? 'all',
    itemIds: draft.appliesTo === 'items' ? (draft.itemIds ?? []) : [],
    minOrder: draft.minOrder ?? null,
    validUntil: draft.validUntil,
    usageLimit: draft.usageLimit ?? null,
    look: draft.look,
  };
}

/** Create an offer, switched on. Returns its id. */
export async function createOffer(merchantId: string, draft: OfferDraft): Promise<string> {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured.');
  const ref = doc(collection(db(), PROMOTIONS));
  await setDoc(ref, {
    merchantId,
    ...fields(draft),
    active: true,
    usedCount: 0,
    createdAt: Date.now(),
  });
  await syncOfferLabel(merchantId);
  return ref.id;
}

export async function updateOffer(offer: Promotion, draft: OfferDraft): Promise<void> {
  if (!isFirebaseReady() || !offer.merchantId) return;
  await updateDoc(doc(db(), PROMOTIONS, offer.id), fields(draft));
  await syncOfferLabel(offer.merchantId);
}

export async function setOfferActive(offer: Promotion, active: boolean): Promise<void> {
  if (!isFirebaseReady() || !offer.merchantId) return;
  await updateDoc(doc(db(), PROMOTIONS, offer.id), { active });
  await syncOfferLabel(offer.merchantId);
}

export async function deleteOffer(offer: Promotion): Promise<void> {
  if (!isFirebaseReady() || !offer.merchantId) return;
  await deleteDoc(doc(db(), PROMOTIONS, offer.id));
  await syncOfferLabel(offer.merchantId);
}

/**
 * Count a use of the promotion an accepted order carried.
 *
 * Only a promotion this restaurant owns can be counted — a platform promo code
 * is refused by the rules — so a failure here is expected for those and never
 * blocks accepting the order.
 */
export async function countOfferUse(promoId: string | undefined | null): Promise<void> {
  if (!isFirebaseReady() || !promoId) return;
  await updateDoc(doc(db(), PROMOTIONS, promoId), { usedCount: increment(1) }).catch(() => {});
}

/**
 * Point the restaurant's `offerLabel` at its newest running offer, or clear it
 * when none is running.
 */
async function syncOfferLabel(merchantId: string): Promise<void> {
  const now = Date.now();
  const running = (await listOffers(merchantId)).find((p) => p.active !== false && p.validUntil > now);
  await updateDoc(doc(db(), MERCHANTS, merchantId), {
    offerLabel: running ? offerHeadline(running, { withDate: false }) : deleteField(),
  });
}
