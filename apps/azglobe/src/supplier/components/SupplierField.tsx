import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontFamily, radius, spacing } from '@core/theme';
import { Text } from '@core/ui';

export type SupplierFieldProps = TextInputProps & {
  label: string;
  /** Marks the label with the asterisk Figma draws on required fields. */
  required?: boolean;
  /** Renders the taller multi-line box used for the description. */
  multiline?: boolean;
  invalid?: boolean;
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
 *   error  the border turns #D74C4D, as drawn on the required name field
 */
export function SupplierField({
  label,
  required,
  multiline,
  invalid,
  style,
  ...inputProps
}: SupplierFieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="eyebrowSm" color={colors.textMuted}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        style={[
          styles.control,
          multiline && styles.multiline,
          invalid && styles.invalid,
          style,
        ]}
        placeholderTextColor="rgba(31,41,55,0.5)"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[3] },
  control: {
    height: 46,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: spacing[4],
    fontFamily: fontFamily[600],
    fontSize: 14,
    lineHeight: 16.8,
    color: colors.text,
  },
  multiline: { height: 83.5, paddingTop: spacing[4], fontSize: 13, lineHeight: 19.5 },
  invalid: { borderColor: '#D74C4D' },
});
