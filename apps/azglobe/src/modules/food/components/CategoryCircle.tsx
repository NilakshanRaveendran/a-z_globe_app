import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@core/ui';
import { colors, spacing } from '@core/theme';
import { categoryIcons, type CategoryKey } from '../data/icons';

export type CategoryCircleProps = {
  categoryKey: CategoryKey;
  label: string;
  selected?: boolean;
  onPress: () => void;
};

/**
 * The horizontally-scrolling food categories under the cuisine chips.
 *
 * Figma (31:11648): button col gap 6 · pad 0/8 · illustration 52 (the tinted
 * circle is part of the artwork) · label Urbanist 500 11/16.5 #1A1A1A centred.
 *
 * Figma has no selected state; the app marks the active category the way it
 * marks an active chip — a 2pt brand-red ring around the artwork and the label
 * in brand red — so a filter set from here is never invisible.
 */
export function CategoryCircle({ categoryKey, label, selected = false, onPress }: CategoryCircleProps) {
  const Illustration = categoryIcons[categoryKey];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={[styles.ring, selected && styles.ringSelected]}>
        <Illustration width={52} height={52} />
      </View>
      <Text
        variant={selected ? 'labelSm' : 'micro'}
        color={selected ? colors.primary : colors.palette.ink}
        align="center"
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
  },
  // 52pt art inside a 2pt ring keeps the 6pt art-to-label gap of the design.
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: { borderColor: colors.primary },
  pressed: { opacity: 0.7 },
});
