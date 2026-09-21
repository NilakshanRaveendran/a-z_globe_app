import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

/**
 * Figma (item detail 116:3078, cart 414:2985):
 *   track  116×40 · r12 · #F3F4F6 · row gap 12 · pad 4
 *   button 32×32 · icon 16 stroke #1F2937
 *   value  Urbanist 700 16/24 #1F2937
 *
 * At `min` the decrement is disabled rather than hidden, so the control never
 * changes width and the row beside it does not reflow.
 */
export function QuantityStepper({ value, onChange, min = 1, max = 99 }: QuantityStepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={styles.track}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        disabled={!canDecrement}
        onPress={() => onChange(value - 1)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="minus" size={16} color={canDecrement ? colors.text : colors.textMuted} />
      </Pressable>

      <Text variant="h3" color={colors.text} align="center" style={styles.value}>
        {value}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={!canIncrement}
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="plus" size={16} color={canIncrement ? colors.text : colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[1.5],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
  },
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  value: { minWidth: 20 },
});
