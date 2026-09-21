import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Text } from '@core/ui';

export type Stat = {
  value: string;
  label: string;
  /** Figma gives each card its own tint: #FFF0F0, #F0F4FF, #FFFBEB. */
  tint: string;
};

/**
 * The three-up stat row — Figma provider dashboard (385:3033) and restaurant
 * hub (385:5072), which use it identically.
 *
 *   card   114x89.5 · r16 · pad 12 · gap 6
 *   value  Urbanist 700 15/22.5 #1F2937
 *   label  Urbanist 500 10/15 #6B7280
 */
export function StatCards({ items }: { items: Stat[] }) {
  return (
    <View style={styles.row}>
      {items.map((s) => (
        <View key={s.label} style={[styles.card, { backgroundColor: s.tint }]}>
          <Text variant="h4" color={colors.text} numberOfLines={1}>
            {s.value}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[4] },
  card: {
    flex: 1,
    minHeight: 89.5,
    borderRadius: radius['3xl'],
    padding: spacing[4],
    gap: spacing[2.5],
    justifyContent: 'center',
  },
});
