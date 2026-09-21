import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@core/ui';
import { colors, spacing } from '@core/theme';
import { categoryIcons, type CategoryKey } from '../data/icons';

export type CategoryCircleProps = {
  categoryKey: CategoryKey;
  label: string;
  onPress: () => void;
};

/**
 * The horizontally-scrolling food categories under the cuisine chips.
 *
 * Figma (31:11648): button col gap 6 · pad 0/8 · illustration 52 (the tinted
 * circle is part of the artwork) · label Urbanist 500 11/16.5 #1A1A1A centred.
 */
export function CategoryCircle({ categoryKey, label, onPress }: CategoryCircleProps) {
  const Illustration = categoryIcons[categoryKey];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Illustration width={52} height={52} />
      <Text variant="micro" color={colors.palette.ink} align="center">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[3],
  },
  pressed: { opacity: 0.7 },
});
