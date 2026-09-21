import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '@core/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type FieldProps = TextInputProps & {
  label: string;
  /** Renders a tappable row with a chevron instead of an input (a picker). */
  onPress?: () => void;
  /** The displayed value when `onPress` is set. */
  displayValue?: string;
};

/**
 * Labelled form field — Figma 400:4244.
 *
 *   label  Urbanist 600 12/18 #374151, 6pt above the control
 *   input  h44.5 · r12 · 0.52px #E5E7EB border · pad 12 ·
 *          text Urbanist 500 13/15.6 (placeholder at 50% #1F2937)
 */
export function Field({ label, onPress, displayValue, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="label" color={colors.palette.gray700}>
        {label}
      </Text>

      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.control, styles.picker, pressed && styles.pressed]}
        >
          <Text variant="body" color={colors.text} style={styles.pickerValue}>
            {displayValue}
          </Text>
          <Icon name="chevronRight" size={16} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <TextInput
          style={[styles.control, styles.input, style]}
          placeholderTextColor="rgba(31,41,55,0.5)"
          {...inputProps}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[2.5] },
  control: {
    borderRadius: radius.xl,
    borderWidth: 0.52,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    minHeight: 44.5,
  },
  input: {
    ...typography.body,
    fontFamily: 'Urbanist_500Medium',
    lineHeight: 15.6,
    color: colors.text,
    paddingVertical: spacing[4],
  },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue: { fontFamily: 'Urbanist_600SemiBold' },
  pressed: { opacity: 0.7 },
});
