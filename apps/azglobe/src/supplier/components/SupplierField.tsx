import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fontFamily, radius, spacing, type typography } from '@core/theme';
import { Text } from '@core/ui';

export type SupplierFieldProps = TextInputProps & {
  label: string;
  /** Marks the label with the asterisk Figma draws on required fields. */
  required?: boolean;
  /** Renders the taller multi-line box used for the description. */
  multiline?: boolean;
  invalid?: boolean;
  /**
   * What is wrong with the value, shown under the box in the brand red. Setting
   * it also draws the invalid border.
   */
  error?: string | null;
  /** A quiet note under the box, e.g. "Closes at 2:00 AM the next day". */
  hint?: string | null;
  /**
   * The label treatment differs between screens: Add Restaurant uses the tracked
   * eyebrow (the default), Restaurant Information and Add New Item a plain label.
   */
  labelVariant?: keyof typeof typography;
  labelColor?: string;
  labelStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  inputRef?: Ref<TextInput>;
};

/**
 * Labelled field for the supplier forms — Figma AddRestaurantSheet (385:4028).
 *
 * Deliberately NOT `@core/ui/Field`, which is the customer-side treatment
 * (400:4244). The provider screens use a different one and the design is the
 * source of truth:
 *
 *   label  Urbanist 700 10/15 ls0.55 #9CA3AF, 8pt above the control
 *   input  h46 · r12 · 0.51px #E5E7EB border · pad 12/14 ·
 *          Urbanist 600 14/16.8 #1F2937 (placeholder at 50%)
 *   error  the border turns #D74C4D, as drawn on the required name field, and
 *          the message sits under the box, 500 12/18 #D42B2B
 *
 * The visible label is also the input's accessible name, so a screen reader
 * announces "Restaurant Name" rather than the placeholder.
 */
export function SupplierField({
  label,
  required,
  multiline,
  invalid,
  error,
  hint,
  style,
  labelVariant = 'eyebrowSm',
  labelColor = colors.textMuted,
  labelStyle,
  containerStyle,
  inputRef,
  ...inputProps
}: SupplierFieldProps) {
  const bad = invalid || !!error;
  return (
    <View style={[styles.field, containerStyle]}>
      <Text variant={labelVariant} color={labelColor} style={labelStyle}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        ref={inputRef}
        accessibilityLabel={required ? `${label}, required` : label}
        style={[
          styles.control,
          multiline && styles.multiline,
          bad && styles.invalid,
          style,
        ]}
        placeholderTextColor="rgba(31,41,55,0.5)"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...inputProps}
      />
      {error ? (
        <Text variant="bodySm" color={colors.primary} style={styles.note} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="microRegular" color={colors.textSecondary} style={styles.note}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[3] },
  control: {
    minHeight: 52,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: spacing[4],
    fontFamily: fontFamily[600],
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  multiline: { minHeight: 100, paddingTop: spacing[4], fontSize: 16, lineHeight: 24 },
  invalid: { borderColor: '#D74C4D' },
  // The field's own gap already separates it from the box; pull the note in.
  note: { marginTop: -spacing[1] },
});
