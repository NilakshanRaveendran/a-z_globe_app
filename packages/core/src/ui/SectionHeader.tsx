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
   * Figma uses two sizes: 'md' (15/22.5, See-all 12/18 + chevron) for panel
   * sections like Popular Dishes, and 'lg' (16/24, See-all 13/19.5, no chevron)
   * for Popular Near You.
   */
  size?: 'md' | 'lg';
  /** The Order Food landing page uses a circular chevron button instead. */
  seeAllVariant?: 'text' | 'circle';
};

export function SectionHeader({
  title,
  subtitle,
  onSeeAll,
  size = 'lg',
  seeAllVariant = 'text',
}: SectionHeaderProps) {
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

      {onSeeAll ? (
        seeAllVariant === 'circle' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
            onPress={onSeeAll}
            style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
          >
            <Icon name="chevronRight" size={13} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
            onPress={onSeeAll}
            hitSlop={8}
            style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
          >
            <Text variant={size === 'lg' ? 'body' : 'label'} color={colors.primary}>
              See all
            </Text>
            {size === 'md' ? <Icon name="chevronRight" size={13} color={colors.primary} /> : null}
          </Pressable>
        )
      ) : null}
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
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5] },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.6 },
});
