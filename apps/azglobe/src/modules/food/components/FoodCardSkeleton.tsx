import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@core/ui/Skeleton';
import { colors, radius, shadows, spacing } from '@core/theme';

/** Mirrors FoodCard's geometry so the grid does not reflow when data lands. */
export function FoodCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={120} borderRadius={0} />
      <View style={styles.body}>
        <Skeleton width="55%" height={10} />
        <Skeleton width="75%" height={14} />
        <Skeleton width="40%" height={14} />
        <Skeleton width="100%" height={10} />
        <Skeleton width="80%" height={10} />
        <View style={styles.footer}>
          <Skeleton width={58} height={10} />
          <Skeleton width={28} height={28} borderRadius={14} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 272.5,
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    ...shadows.card,
  },
  body: { padding: spacing[4], gap: spacing[1.5] },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[1.5],
  },
});
