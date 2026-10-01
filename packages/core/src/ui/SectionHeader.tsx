import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@core/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type SectionHeaderProps = {
  title: string;
  /** "Most ordered this week" under "Top Spots Near You". */
  subtitle?: string;
  onSeeAll?: () => void;
  /**
   * Title size: 'md' (15/22.5) for panel sections like Popular Dishes, 'lg'
   * (16/24) for Popular Near You. The See-all button is the same in both.
   */
  size?: 'md' | 'lg';
};

/**
 * "See all ›" — the red label and its arrow, one button (no circle). Every section
 * that leads to a full list uses this, so it looks and behaves the same on
 * Home, Order Food and the restaurant page.
 */
export function SeeAllButton({ section, onPress }: { section: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`See all ${section}`}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
    >
      <Text variant="labelMd" color={colors.primary}>
        See all
      </Text>
      <Icon name="chevronRight" size={14} color={colors.primary} />
    </Pressable>
  );
}

export function SectionHeader({ title, subtitle, onSeeAll, size = 'lg' }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text variant={size === 'lg' ? 'h3' : 'h4'} color={size === 'lg' ? colors.text : colors.textHeading}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color={colors.textMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onSeeAll ? <SeeAllButton section={title} onPress={onSeeAll} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  titles: { flex: 1, gap: spacing[0.5] },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexShrink: 0 },
  pressed: { opacity: 0.6 },
});
