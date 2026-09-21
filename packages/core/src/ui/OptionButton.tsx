import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Text } from './Text';

export type OptionButtonProps = {
  label: string;
  /** Secondary line, e.g. "+Rs. 400" on the Large size option. */
  subLabel?: string;
  selected: boolean;
  onPress: () => void;
  /** 'lg' matches Size options (14/21, pad 11); 'sm' matches Spice (12/18, pad 10). */
  size?: 'lg' | 'sm';
  style?: ViewStyle;
};

/**
 * The bordered selector used for Size / Spice Level on the item detail screen.
 *
 * Figma (116:3078):
 *   selected    fill #FFF1F1 · border #D42B2B 1.63 · r12 · label #D42B2B
 *   unselected  fill #FFFFFF · border #E5E7EB 1.63 · r12 · label #4B5563
 */
export function OptionButton({
  label,
  subLabel,
  selected,
  onPress,
  size = 'lg',
  style,
}: OptionButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.sm,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        variant={size === 'lg' ? 'labelLg' : 'label'}
        color={selected ? colors.primary : colors.palette.gray600}
        align="center"
      >
        {label}
      </Text>
      {subLabel ? (
        <Text variant="micro" color={colors.textMuted} align="center">
          {subLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1.63,
  },
  lg: { paddingVertical: 11 },
  sm: { paddingVertical: spacing[3.5] },
  selected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: 0.85 },
});
