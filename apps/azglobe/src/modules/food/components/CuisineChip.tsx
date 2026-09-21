import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { cuisineIcons, type CuisineKey } from '../data/icons';

export type CuisineChipProps = {
  cuisineKey: CuisineKey;
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Cuisine filter pill on the Order Food landing page.
 *
 * Figma (31:11648): h39 · r:pill · row gap 6 · pad 5/12/5/5
 *   selected   #D42B2B, label #FFFFFF, icon well transparent (r7)
 *   unselected #FFFFFF + #E5E7EB border, label #1A1A1A, icon well #F3F4F6 round
 *   label Urbanist 600 13/19.5 · icon well 28 · illustration 18
 */
export function CuisineChip({ cuisineKey, label, selected, onPress }: CuisineChipProps) {
  const Illustration = cuisineIcons[cuisineKey];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.well, selected ? styles.wellSelected : styles.wellUnselected]}>
        <Illustration width={18} height={18} />
      </View>
      <Text variant="body" color={selected ? colors.onPrimary : colors.palette.ink}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingLeft: spacing[2],
    paddingRight: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    borderWidth: 0.54,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: 0.85 },
  well: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  wellSelected: { borderRadius: 7 },
  wellUnselected: { borderRadius: 14, backgroundColor: colors.surfaceAlt },
});
