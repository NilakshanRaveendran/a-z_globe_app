import { StyleSheet, View } from 'react-native';
import { Card, StarRow, Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';

export type RatingSummaryProps = {
  rating: number;
  reviewCount: number;
  /** Percentage of reviews at each star level, 5 → 1. */
  breakdown: Array<{ stars: number; percent: number }>;
};

/**
 * The score panel at the top of the Reviews tab — Figma 18:5057.
 *
 *   left   big score Urbanist 700 ~36, stars, "234 reviews" #9CA3AF
 *   right  five bars: "5 ★" label, an #E5E7EB track with an #FBBF24 fill,
 *          and the percentage on the right
 *   the two halves are separated by a 1px vertical rule
 */
export function RatingSummary({ rating, reviewCount, breakdown }: RatingSummaryProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.score}>
        <Text variant="h1" color={colors.textHeading} style={styles.scoreValue}>
          {rating.toFixed(1)}
        </Text>
        <StarRow rating={rating} size={14} />
        <Text variant="bodySm" color={colors.textMuted}>
          {reviewCount} reviews
        </Text>
      </View>

      <View style={styles.rule} />

      <View style={styles.bars}>
        {breakdown.map((row) => (
          <View key={row.stars} style={styles.barRow}>
            <Text variant="bodySm" color={colors.textSecondary} style={styles.barStars}>
              {row.stars}
            </Text>
            <Text variant="bodySm" color={row.stars >= 4 ? colors.star : colors.textMuted}>
              ★
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${row.percent}%` }]} />
            </View>
            <Text variant="bodySm" color={colors.textMuted} style={styles.percent} align="right">
              {row.percent}%
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
  score: { alignItems: 'center', gap: spacing[1.5] },
  scoreValue: { fontSize: 36, lineHeight: 44 },
  rule: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  bars: { flex: 1, gap: spacing[2.5] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  barStars: { width: 10 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.star },
  percent: { width: 34 },
});
