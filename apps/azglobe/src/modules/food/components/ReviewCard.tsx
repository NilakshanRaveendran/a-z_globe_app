import { StyleSheet, View } from 'react-native';
import { Card, StarRow, Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import type { Review } from '../types';

const AVATAR_TINTS = ['#FEE2E2', '#EDE9FE', '#DCFCE7', '#FFEDD5', '#DBEAFE'];
const AVATAR_INK = ['#D42B2B', '#7C3AED', '#16A34A', '#EA580C', '#2563EB'];

/**
 * A single review — Figma 18:5057.
 *
 *   card    r16 · #FFF · shadow card · pad 16
 *   avatar  40pt circle, tinted from the reviewer's initial
 *   name    Urbanist 700 14/21 + stars 10 + relative time 400 11/16.5 #9CA3AF
 *   dish    chip pad 4/10 · r:pill · #FFF1F1 · Urbanist 600 11/16.5 #D42B2B
 *   body    Urbanist 400 13/19.5 #374151
 */
export function ReviewCard({ review }: { review: Review }) {
  const seed = review.userName.charCodeAt(0) % AVATAR_TINTS.length;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: AVATAR_TINTS[seed] }]}>
          <Text variant="h5" color={AVATAR_INK[seed] ?? colors.primary}>
            {review.userName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.flex}>
          <Text variant="h5" color={colors.textStrong}>
            {review.userName}
          </Text>
          <View style={styles.stars}>
            <StarRow rating={review.rating} size={10} />
          </View>
        </View>

        <Text variant="microRegular" color={colors.textMuted}>
          {relativeTime(review.createdAt)}
        </Text>
      </View>

      {review.dishTag ? (
        <View style={styles.dishChip}>
          <Text variant="labelSm" color={colors.primary}>
            {review.dishTag}
          </Text>
        </View>
      ) : null}

      <Text variant="bodyRegular" color={colors.palette.gray700} style={styles.body}>
        {review.text}
      </Text>
    </Card>
  );
}

/** Matches the design's phrasing: "2 days ago", "1 week ago", "2 weeks ago". */
export function relativeTime(timestamp: number): string {
  const days = Math.max(0, Math.round((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

const styles = StyleSheet.create({
  card: { gap: spacing[4] },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4] },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  stars: { paddingTop: spacing[1] },
  dishChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  body: { lineHeight: 19.5 },
});
