import { deleteField, doc, getFirestore, updateDoc } from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readCollection } from '@core/firebase/db';
import type { Merchant, Review } from '@modules/food/types';
import {
  readDemoReviews,
  writeDemoReviews,
} from '@modules/food/services/demoCatalogue';

/**
 * A restaurant's reviews, as its owner sees them — Figma 385:5924.
 *
 * Reviews live at `merchants/{merchantId}/reviews/{reviewId}` and are written by
 * customers (see `firestore.rules`). The owner may touch exactly two fields on
 * them, and the rules enforce that:
 *
 *   reply             `{ text, createdAt }` — the "Response from <restaurant>"
 *                     box. Removing the field deletes the reply.
 *   hiddenByMerchant  an owner-side archive. It only moves the review under the
 *                     "Hide" filter on this screen; customers still see it, and
 *                     it still counts towards the rating.
 */

/** The rules refuse a longer reply (`validReply` in firestore.rules). */
export const REPLY_MAX_LENGTH = 1000;

/**
 * How many reviews the screen loads. Beyond this the summary falls back to the
 * restaurant's own `rating` / `reviewCount` — see `summarizeReviews`.
 */
export const REVIEW_PAGE_SIZE = 100;

export type ReviewReply = { text: string; createdAt: number };

export type MerchantReview = Review & {
  reply?: ReviewReply;
  hiddenByMerchant?: boolean;
};

const MERCHANTS = 'merchants';
const reviewsPath = (merchantId: string) => `${MERCHANTS}/${merchantId}/reviews`;
const db = () => getFirestore(getApp());

/**
 * Epoch millis from either a number or a Firestore Timestamp. The seed script
 * writes `createdAt` as a Timestamp; the app itself writes numbers.
 */
function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  const maybe = value as { toMillis?: () => number } | null | undefined;
  return typeof maybe?.toMillis === 'function' ? maybe.toMillis() : 0;
}

function normalise(raw: MerchantReview): MerchantReview {
  const reply = raw.reply && typeof raw.reply.text === 'string' && raw.reply.text.trim()
    ? { text: raw.reply.text, createdAt: toMillis(raw.reply.createdAt) }
    : undefined;
  return {
    ...raw,
    userName: raw.userName || 'Customer',
    text: raw.text ?? '',
    createdAt: toMillis(raw.createdAt),
    reply,
    hiddenByMerchant: raw.hiddenByMerchant === true,
  };
}

const newestFirst = (a: MerchantReview, b: MerchantReview) => b.createdAt - a.createdAt;

// ── Demo mode ─────────────────────────────────────────────────────────────
//
// Without Firebase the reviews live in the shared demo catalogue: customers
// write into it (`submitReview`) and read it on the restaurant's Reviews tab,
// so a reply posted here is what the customer sees under their review. The
// two restaurants the demo business owns start with reviews; a new restaurant
// starts with none (audit S4).

function demoReviews(merchantId: string): MerchantReview[] {
  return readDemoReviews(merchantId);
}

function saveDemoReviews(merchantId: string, reviews: MerchantReview[]): void {
  writeDemoReviews(merchantId, reviews);
}

function editDemoReview(
  merchantId: string,
  reviewId: string,
  edit: (review: MerchantReview) => MerchantReview
): void {
  const reviews = demoReviews(merchantId);
  if (!reviews.some((r) => r.id === reviewId)) throw new Error('Review not found.');
  saveDemoReviews(merchantId, reviews.map((r) => (r.id === reviewId ? edit(r) : r)));
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** A restaurant's reviews, newest first — hidden ones included (the screen filters). */
export async function listReviews(merchantId: string): Promise<MerchantReview[]> {
  if (!merchantId) return [];
  if (!isFirebaseReady()) return demoReviews(merchantId).map(normalise).sort(newestFirst);
  const { rows } = await readCollection<MerchantReview>(reviewsPath(merchantId), {
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: REVIEW_PAGE_SIZE,
  });
  return rows.map(normalise).sort(newestFirst);
}

export type RatingSummary = {
  /** 0–5, one decimal. */
  average: number;
  total: number;
  /** Reviews per star, indexed by star: `byStar[5]` is the five-star count (index 0 unused). */
  byStar: number[];
};

/**
 * The summary block — computed from the loaded reviews, hidden ones included
 * (hiding is an owner-side archive, not a moderation action).
 *
 * When the restaurant has more reviews than one page (`merchant.reviewCount`
 * exceeds what was loaded), the headline average and count come from the
 * restaurant document instead, and the bars show the loaded page's spread.
 */
export function summarizeReviews(
  reviews: MerchantReview[],
  merchant?: Pick<Merchant, 'rating' | 'reviewCount'> | null
): RatingSummary {
  const byStar = [0, 0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
    byStar[star] = (byStar[star] ?? 0) + 1;
    sum += star;
  }
  const paged = merchant != null && (merchant.reviewCount ?? 0) > reviews.length;
  if (paged) {
    return {
      average: Math.round((merchant.rating ?? 0) * 10) / 10,
      total: merchant.reviewCount,
      byStar,
    };
  }
  return {
    average: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : 0,
    total: reviews.length,
    byStar,
  };
}

// ── Owner writes ──────────────────────────────────────────────────────────

/** Post or replace the restaurant's reply. Returns what was stored. */
export async function replyToReview(
  merchantId: string,
  reviewId: string,
  text: string
): Promise<ReviewReply> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Write a reply first.');
  if (trimmed.length > REPLY_MAX_LENGTH) {
    throw new Error(`Keep your reply under ${REPLY_MAX_LENGTH} characters.`);
  }
  const reply: ReviewReply = { text: trimmed, createdAt: Date.now() };

  if (!isFirebaseReady()) {
    editDemoReview(merchantId, reviewId, (r) => ({ ...r, reply }));
    return reply;
  }
  await updateDoc(doc(db(), reviewsPath(merchantId), reviewId), { reply });
  return reply;
}

/** Remove the restaurant's reply; the review goes back to "Not Replied". */
export async function deleteReply(merchantId: string, reviewId: string): Promise<void> {
  if (!isFirebaseReady()) {
    editDemoReview(merchantId, reviewId, ({ reply: _removed, ...rest }) => rest);
    return;
  }
  await updateDoc(doc(db(), reviewsPath(merchantId), reviewId), { reply: deleteField() });
}

/** Archive a review under "Hide", or bring it back. Customers are unaffected. */
export async function setReviewHidden(
  merchantId: string,
  reviewId: string,
  hidden: boolean
): Promise<void> {
  if (!isFirebaseReady()) {
    editDemoReview(merchantId, reviewId, (r) => ({ ...r, hiddenByMerchant: hidden }));
    return;
  }
  await updateDoc(doc(db(), reviewsPath(merchantId), reviewId), { hiddenByMerchant: hidden });
}
