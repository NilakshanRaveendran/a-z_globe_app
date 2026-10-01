import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leadingIcon?: ReactNode;
  style?: ViewStyle;
};

/**
 * The pill filter used for cuisine rows ("All / Sri Lankan / Cafe / Seafood"),
 * menu categories ("Popular / Rice & Curry / Drinks") and the review filters.
 *
 * Figma (31:11648, 17:4787): r:pill · selected #D42B2B + white label ·
 * unselected #F3F4F6 (or white + #E5E7EB border) + #1F2937 label.
 */
export function Chip({ label, selected = false, onPress, leadingIcon, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
    >
      {leadingIcon}
      <Text variant="label" color={selected ? colors.onPrimary : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radius.pill,
  },
  selected: { backgroundColor: colors.primary },
  unselected: { backgroundColor: colors.surfaceAlt },
  filterSelected: {
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  filterUnselected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
});
