import { getAuth } from '@core/firebase/auth';
import { doc, getFirestore, setDoc } from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import type { Order, Review } from '../types';
import { appendDemoReview, DEMO_CUSTOMER_ID, readDemoReviews } from './demoCatalogue';

/**
 * Customer-written reviews — `merchants/{merchantId}/reviews/{id}` (audit C8).
 *
 * `firestore.rules` accepts a review only from a CUSTOMER account, under its
 * own uid, with a 1–5 rating, pointing at one of that customer's DELIVERED
 * orders from this restaurant — and stored under that order's id, so each
 * order can be reviewed once. The owner can then reply to it or hide it on
 * their Reviews screen, but never change its words or stars.
 *
 * In demo mode the review goes into the shared demo catalogue, so it shows on
 * the restaurant's Reviews tab straight away and on the business account's
 * Reviews screen, where it can be answered.
 */

const ALREADY_REVIEWED = "You've already reviewed this order.";

/** Longest review body accepted — the Write-a-Review sheet counts to 300. */
export const REVIEW_TEXT_MAX = 1000;

export type SubmitReviewInput = {
  merchantId: string;
  /** 1–5 stars. */
  rating: number;
  text: string;
  /** The dish chip shown above the review. */
  dishTag?: string;
  /**
   * The delivered order being reviewed. When absent, the customer's most
   * recent delivered order from this restaurant is used (Firebase only).
   */
  orderId?: string;
  /** How the review is signed. Defaults to the account's display name. */
  userName?: string;
};

export async function submitReview(input: SubmitReviewInput): Promise<Review> {
  const merchantId = input.merchantId?.trim();
  if (!merchantId) throw new Error('Choose a restaurant to review.');
  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) throw new Error('Choose a rating from 1 to 5 stars.');
  const text = (input.text ?? '').trim();
  if (text.length > REVIEW_TEXT_MAX) {
    throw new Error(`Keep your review under ${REVIEW_TEXT_MAX} characters.`);
  }
  const dishTag = input.dishTag?.trim();
  const createdAt = Date.now();

  if (!isFirebaseReady()) {
    // Same one-review-per-order rule as Firestore.
    if (input.orderId && readDemoReviews(merchantId).some((r) => r.orderId === input.orderId)) {
      throw new Error(ALREADY_REVIEWED);
    }
    const review: Review = {
      id: input.orderId || `review-${createdAt.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      merchantId,
      userId: DEMO_CUSTOMER_ID,
      userName: input.userName?.trim() || 'Vanan',
      rating,
      text,
      ...(dishTag ? { dishTag } : {}),
      helpfulCount: 0,
      createdAt,
      ...(input.orderId ? { orderId: input.orderId } : {}),
    };
    appendDemoReview(review);
    return review;
  }

  const user = getAuth(getApp()).currentUser;
  if (!user) throw new Error('Sign in to write a review.');
  const orderId = input.orderId || (await latestDeliveredOrderId(user.uid, merchantId));
  if (!orderId) {
    throw new Error('You can review this restaurant once an order from it has been delivered.');
  }

  // Exactly the fields the rules check, plus what the Reviews screens render.
  // Never an `undefined` — Firestore refuses the whole write for one.
  const fields = {
    merchantId,
    userId: user.uid,
    userName: input.userName?.trim() || user.displayName?.trim() || 'Customer',
    rating,
    text,
    ...(dishTag ? { dishTag } : {}),
    orderId,
    helpfulCount: 0,
    createdAt,
  };
  // Stored under the order's id: the rules allow one review per order, and a
  // second write to the same id is an edit they refuse.
  await setDoc(doc(getFirestore(getApp()), `merchants/${merchantId}/reviews`, orderId), fields).catch(
    (e: unknown) => {
      const code = (e as { code?: string } | null)?.code ?? '';
      if (code.includes('permission-denied')) {
        throw new Error('Each delivered order can be reviewed once — this one already has been, or it isn’t delivered yet.');
      }
      throw e;
    }
  );
  return { id: orderId, ...fields };
}

/**
 * The customer's newest delivered order from this restaurant. Equality filters
 * only, so no composite index is needed; the rules allow it because the query
 * is limited to the customer's own orders.
 */
/**
 * The signed-in customer's newest delivered order from this restaurant — what
 * a review must point at. Firebase only (demo mode has no such rule).
 */
export async function findReviewableOrderId(merchantId: string): Promise<string | null> {
  if (!isFirebaseReady()) return null;
  const uid = getAuth(getApp()).currentUser?.uid;
  return uid ? latestDeliveredOrderId(uid, merchantId) : null;
}

async function latestDeliveredOrderId(uid: string, merchantId: string): Promise<string | null> {
  const { rows } = await readCollection<Order>('orders', {
    where: [
      ['userId', '==', uid],
      ['merchantId', '==', merchantId],
      ['status', '==', 'delivered'],
    ],
    limit: 10,
  });
  const newest = [...rows].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0];
  return newest?.id ?? null;
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  const maybe = value as { toMillis?: () => number } | null | undefined;
  return typeof maybe?.toMillis === 'function' ? maybe.toMillis() : 0;
}
