import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, fontFamily, radius, SCREEN_PADDING, shadows, spacing, typography } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, StarRow, Text, showToast } from '@core/ui';
import { Alert } from '@core/ui/alert';
import { formatDate } from '@core/utils/datetime';
import type { RootStackParamList } from '@app/navigation/types';
import type { Merchant } from '@modules/food/types';
import { SupplierPageHeader } from '../components/SupplierPageHeader';
import { ReviewReplySheet } from '../components/ReviewReplySheet';
import { ActionMenu, measureAnchor, type ActionMenuItem, type MenuAnchor } from '../components/ActionMenu';
import { getOwnedRestaurant } from '../services/restaurants';
import {
  deleteReply,
  listReviews,
  setReviewHidden,
  summarizeReviews,
  type MerchantReview,
  type RatingSummary,
  type ReviewReply,
} from '../services/reviews';
import { initials } from '@core/utils/text';

/**
 * Reviews — Figma 385:5924.
 *
 *   header   SupplierPageHeader at the Reviews spec: 23 above the back button,
 *            title 700 22/33 12 below it, restaurant name 400 13/19.5 #D42B2B
 *   summary  385:5526 · pad 14/16 · 0.51px #F3F4F6 rule · gap 16
 *            "4.8" 700 40/48 #1F2937 · 5 × 14pt stars gap 2 · "234 Reviews"
 *            500 11/16.5 #9CA3AF; five bars gap 5: digit 500 10/15 #9CA3AF
 *            (6 wide, right-aligned) · 10pt star · 6h #F3F4F6 track with a
 *            #FBBF24 fill (share of all reviews) · count 22 wide · row gap 7
 *   filters  385:5602 · pad 10/16 · 0.51px #F3F4F6 rule · 30h pills gap 8,
 *            pad 6/14, 600 12/18 — on #D42B2B/white, off #F3F4F6/#6B7280
 *   list     24 below the filters, cards 10 apart (ReviewCard, 385:7179)
 *
 * The four sections sit 12 apart, as drawn.
 *
 * Filters: "All Reviews", "Not Replied" and "Replied" cover the reviews the
 * owner has not hidden; "Hidden" lists the hidden ones (Figma's chip reads
 * "Hide", which reads as an action). Hiding is an owner-side archive only —
 * customers still see the review and it still counts — so the Hidden list
 * says so under the chips, and hiding confirms with a toast that can undo it.
 */
type Filter = 'all' | 'notReplied' | 'replied' | 'hidden';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All Reviews' },
  { key: 'notReplied', label: 'Not Replied' },
  { key: 'replied', label: 'Replied' },
  { key: 'hidden', label: 'Hidden' },
];

const EMPTY: Record<Filter, { title: string; message: string }> = {
  all: {
    title: 'No reviews yet',
    message: 'When customers review their orders, you will see them here.',
  },
  notReplied: { title: 'All caught up', message: 'Every review has a reply from you.' },
  replied: { title: 'No replies yet', message: 'Reviews you reply to will appear here.' },
  hidden: { title: 'Nothing hidden', message: 'Reviews you hide from this list are kept here.' },
};

export function ReviewsScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierReviews'>>();
  const { merchantId, merchantName } = params;

  const [reviews, setReviews] = useState<MerchantReview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [restaurant, setRestaurant] = useState<Pick<Merchant, 'rating' | 'reviewCount'> | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [replying, setReplying] = useState<MerchantReview | null>(null);
  const [menu, setMenu] = useState<{ review: MerchantReview; anchor: MenuAnchor } | null>(null);

  const load = useCallback(async () => {
    try {
      const [rows, merchant] = await Promise.all([
        listReviews(merchantId),
        getOwnedRestaurant(merchantId).catch(() => null),
      ]);
      setReviews(rows);
      setFailed(false);
      // When the restaurant has counted more reviews than were loaded, the
      // headline figures come from it — the same rule the stat cards use.
      setRestaurant(merchant ? { rating: merchant.rating, reviewCount: merchant.reviewCount } : null);
    } catch {
      setReviews([]);
      setFailed(true);
    }
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeReviews(reviews ?? [], restaurant), [reviews, restaurant]);

  const visible = useMemo(
    () =>
      (reviews ?? []).filter((r) => {
        if (filter === 'hidden') return r.hiddenByMerchant;
        if (r.hiddenByMerchant) return false;
        if (filter === 'replied') return Boolean(r.reply);
        if (filter === 'notReplied') return !r.reply;
        return true;
      }),
    [reviews, filter]
  );

  const patch = (reviewId: string, change: (r: MerchantReview) => MerchantReview) =>
    setReviews((current) => current?.map((r) => (r.id === reviewId ? change(r) : r)) ?? current);

  const onReplySaved = (reviewId: string, reply: ReviewReply) => {
    const edited = Boolean(replying?.reply);
    patch(reviewId, (r) => ({ ...r, reply }));
    setReplying(null);
    showToast(edited ? 'Reply updated' : 'Reply posted');
  };

  const setHidden = async (review: MerchantReview, hidden: boolean, undoable: boolean) => {
    try {
      await setReviewHidden(merchantId, review.id, hidden);
      patch(review.id, (r) => ({ ...r, hiddenByMerchant: hidden }));
      if (!undoable) return;
      showToast(
        hidden ? `${review.userName}’s review hidden from this list` : `${review.userName}’s review is back in the list`,
        { action: { label: 'Undo', onPress: () => void setHidden(review, !hidden, false) } }
      );
    } catch {
      showToast(hidden ? 'Could not hide the review. Try again.' : 'Could not unhide the review. Try again.', {
        tone: 'error',
      });
    }
  };

  const toggleHidden = (review: MerchantReview) => setHidden(review, !review.hiddenByMerchant, true);

  const confirmDeleteReply = (review: MerchantReview) => {
    Alert.alert('Delete reply?', 'Your response will be removed from this review.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteReply(merchantId, review.id)
            .then(() => {
              patch(review.id, ({ reply: _removed, ...rest }) => rest);
              showToast('Reply deleted');
            })
            .catch(() =>
              Alert.alert('Could not delete the reply', 'Check your connection and try again.')
            );
        },
      },
    ]);
  };

  return (
    <Screen>
      <SupplierPageHeader
        title="Reviews"
        titleStyle={styles.title}
        subtitle={
          <Text variant="body" color={colors.primary} style={styles.subtitle}>
            {merchantName}
          </Text>
        }
        subtitleColor={colors.primary}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setMenu(null)}
      >
        <RatingSummaryBlock summary={summary} loading={reviews === null} />

        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {FILTERS.map(({ key, label }) => {
              const on = key === filter;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setFilter(key)}
                  style={[styles.filter, on && styles.filterOn]}
                >
                  <Text variant="label" color={on ? colors.onPrimary : colors.textSecondary}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {filter === 'hidden' && visible.length ? (
          <Text variant="microRegular" color={colors.textMuted} style={styles.hiddenNote}>
            Only hidden from this list — customers still see these reviews, and they still count toward your rating.
          </Text>
        ) : null}

        <View style={styles.list}>
          {reviews === null ? (
            <>
              <Skeleton height={185} borderRadius={radius['3xl']} />
              <Skeleton height={185} borderRadius={radius['3xl']} />
            </>
          ) : failed ? (
            <EmptyState
              title="Could not load reviews"
              message="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => {
                setReviews(null);
                void load();
              }}
            />
          ) : visible.length === 0 ? (
            <EmptyState icon="reviews" {...EMPTY[filter]} />
          ) : (
            visible.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                merchantName={merchantName}
                onReply={() => setReplying(review)}
                onMenu={(anchor) => setMenu({ review, anchor })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <ActionMenu
        anchor={menu?.anchor ?? null}
        items={menu ? reviewMenuItems(menu.review, {
          onEditReply: (review) => setReplying(review),
          onDeleteReply: confirmDeleteReply,
          onToggleHidden: (review) => void toggleHidden(review),
        }) : []}
        onClose={() => setMenu(null)}
      />

      <ReviewReplySheet
        review={replying}
        merchantId={merchantId}
        onClose={() => setReplying(null)}
        onSaved={onReplySaved}
      />
    </Screen>
  );
}

/** Figma 385:5526 — the average, its stars and count, and the 5→1 breakdown. */
function RatingSummaryBlock({ summary, loading }: { summary: RatingSummary; loading: boolean }) {
  const { average, total, byStar } = summary;
  return (
    <View style={styles.summary}>
      <View style={styles.summaryLead}>
        <Text variant="ratingHero" color={colors.text}>
          {/* "0.0" read as a terrible score; with no reviews there is none. */}
          {loading || !total ? '–' : average.toFixed(1)}
        </Text>
        <StarRow rating={average} size={14} />
        <Text variant="micro" color={colors.textMuted}>
          {loading ? ' ' : total ? `${total} ${total === 1 ? 'Review' : 'Reviews'}` : 'No reviews yet'}
        </Text>
      </View>

      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = byStar[star] ?? 0;
          // Each bar is that star's share of every loaded review, as drawn
          // (145 of 234 fills 62% of the track).
          const loaded = byStar.reduce((a, b) => a + b, 0);
          const share = loaded ? count / loaded : 0;
          return (
            <View key={star} style={styles.barRow}>
              <Text variant="caption" color={colors.textMuted} align="right" style={styles.barDigit}>
                {star}
              </Text>
              <Icon name="star" size={10} color={colors.star} />
              <View style={styles.track}>
                {share > 0 ? <View style={[styles.fill, { width: `${share * 100}%` }]} /> : null}
              </View>
              <Text variant="caption" color={colors.textMuted} style={styles.barCount}>
                {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * One review — Figma ReviewCard 385:7179 (awaiting a reply) and 389:7506
 * (answered).
 *
 *   card    #FFFFFF · 0.51px #E5E7EB · r16 · shadow 0 1 3 6%
 *   head    pad 14/14/10 · gap 10 · 38pt #D42B2B avatar, initial 700 14/21
 *           white · name 700 13/19.5 #1F2937 · 12pt stars gap 2, then the
 *           date 400 10/15 #9CA3AF 6 over · 26pt #F3F4F6 "⋮" (14pt #9CA3AF)
 *   dish    pill 2 below the head, 8 above the text · pad 3/8 · #FFF0F0 ·
 *           0.51px #D42B2B@12% · 10pt icon gap 5 · 500 10/15 #D42B2B
 *   text    pad 0/14/12 · 400 13/19.5 #374151
 *   reply   either "Reply to this review" — 0.51px #F3F4F6 rule, pad 10/14,
 *           14pt icon gap 6, 600 12/18 #D42B2B — or the response box: pad
 *           0/14/12 around #F9FAFB · 0.51px #E5E7EB · r12 · pad 10/12 ·
 *           "RESPONSE FROM …" 700 10/15 ls0.55 #9CA3AF · reply 400 12/18
 *           #374151, 4 below
 */
function ReviewCard({
  review,
  merchantName,
  onReply,
  onMenu,
}: {
  review: MerchantReview;
  merchantName: string;
  onReply: () => void;
  onMenu: (anchor: MenuAnchor) => void;
}) {
  const more = useRef<View>(null);

  const openMenu = () => measureAnchor(more, onMenu);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.avatar}>
          <Text variant="h5" color={colors.onPrimary}>
            {initials(review.userName, 1)}
          </Text>
        </View>

        <View style={styles.who}>
          <Text variant="body" color={colors.text} style={styles.name} numberOfLines={1}>
            {review.userName}
          </Text>
          <View style={styles.meta}>
            <StarRow rating={review.rating} size={12} />
            <Text variant="captionRegular" color={colors.textMuted}>
              {formatDate(review.createdAt)}
            </Text>
          </View>
        </View>

        <Pressable
          ref={more}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${review.userName}'s review`}
          onPress={openMenu}
          hitSlop={8}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Icon name="moreVertical" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      {review.dishTag ? (
        <View style={styles.dishRow}>
          <View style={styles.dish}>
            <Icon name="dishTag" size={10} color={colors.primary} />
            <Text variant="caption" color={colors.primary}>
              {review.dishTag}
            </Text>
          </View>
        </View>
      ) : null}

      {review.text ? (
        <Text variant="body" color={colors.palette.gray700} style={styles.reviewText}>
          {review.text}
        </Text>
      ) : null}

      {review.reply ? (
        <View style={styles.responseWrap}>
          <View style={styles.response}>
            <Text variant="eyebrowSm" color={colors.textMuted} style={styles.responseLabel}>
              {`Response from ${merchantName}`}
            </Text>
            <Text variant="bodyRegular" color={colors.palette.gray700} style={styles.responseText}>
              {review.reply.text}
            </Text>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onReply}
          style={({ pressed }) => [styles.replyRow, pressed && styles.pressed]}
        >
          <Icon name="reply" size={14} color={colors.primary} />
          <Text variant="label" color={colors.primary}>
            Reply to this review
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * The "⋮" items — Figma 432:3456, drawn by the shared ActionMenu.
 *
 * Figma's first item is "Report Review"; reporting has no backend yet, so the
 * menu carries the owner's own actions instead: edit/delete the reply, and
 * hide/unhide.
 */
function reviewMenuItems(
  review: MerchantReview,
  actions: {
    onEditReply: (review: MerchantReview) => void;
    onDeleteReply: (review: MerchantReview) => void;
    onToggleHidden: (review: MerchantReview) => void;
  }
): ActionMenuItem[] {
  return [
    ...(review.reply
      ? [
          { label: 'Edit Reply', icon: 'pencilSm' as const, onPress: () => actions.onEditReply(review) },
          {
            label: 'Delete Reply',
            icon: 'trash' as const,
            destructive: true,
            onPress: () => actions.onDeleteReply(review),
          },
        ]
      : []),
    review.hiddenByMerchant
      ? { label: 'Unhide Review', icon: 'plusCircle', onPress: () => actions.onToggleHidden(review) }
      : { label: 'Hide Review', icon: 'xCircle', destructive: true, onPress: () => actions.onToggleHidden(review) },
  ];
}

const HAIRLINE = 0.51;

const styles = StyleSheet.create({
  title: { ...typography.pageTitle, marginTop: spacing[4] },
  subtitle: { fontFamily: fontFamily[400] },
  content: { paddingTop: spacing[4], paddingBottom: spacing[12] },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[5],
    borderBottomWidth: HAIRLINE,
    borderBottomColor: colors.surfaceAlt,
  },
  summaryLead: { width: 78, alignItems: 'center', gap: spacing[1.5] },
  bars: { flex: 1, gap: spacing[2] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 15 },
  barDigit: { width: 6 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.star },
  barCount: { width: 22 },

  filterBar: {
    marginTop: spacing[4],
    paddingVertical: spacing[3.5],
    borderBottomWidth: HAIRLINE,
    borderBottomColor: colors.surfaceAlt,
  },
  filters: { paddingHorizontal: SCREEN_PADDING, gap: spacing[3] },
  filter: {
    height: 30,
    paddingHorizontal: spacing[5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOn: { backgroundColor: colors.primary },

  list: { paddingTop: spacing[9], paddingHorizontal: SCREEN_PADDING, gap: spacing[3.5] },
  hiddenNote: { paddingTop: spacing[4], paddingHorizontal: SCREEN_PADDING, marginBottom: -spacing[4] },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    ...shadows.reviewCard,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3.5],
    paddingTop: spacing[5],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3.5],
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { flex: 1 },
  name: { fontFamily: fontFamily[700] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  more: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishRow: { paddingTop: spacing[0.5], paddingBottom: spacing[3], paddingHorizontal: spacing[5] },
  dish: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    borderWidth: HAIRLINE,
    borderColor: colors.primaryHairline,
    backgroundColor: colors.palette.red25,
  },
  reviewText: { fontFamily: fontFamily[400], paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    borderTopWidth: HAIRLINE,
    borderTopColor: colors.surfaceAlt,
  },
  responseWrap: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  response: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  responseLabel: { textTransform: 'uppercase' },
  responseText: { paddingTop: spacing[1.5] },

  pressed: { opacity: 0.6 },
});
