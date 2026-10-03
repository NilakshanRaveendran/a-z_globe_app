import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label — e.g. the cart glyph on "Add to Cart". */
  leadingIcon?: ReactNode;
  /** Rendered after the label — e.g. the chevron on "Go to Checkout". */
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
};

/**
 * Figma (cart 414:2985, checkout 414:3339):
 *   primary   h51-52 · r14 · #D42B2B · pad 14v · row gap 8 · label Urbanist 700 15/22.5 #FFF
 *   secondary          r14 · #FFF    · border #E5E7EB · label Urbanist 700 14/21 #364153
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = true,
  style,
}: ButtonProps) {
  const isInert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      disabled={isInert}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isInert && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <>
          {leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
          <Text variant="labelLg" color={labelColor[variant]} align="center">
            {label}
          </Text>
          {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}

const labelColor: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: '#364153',
  ghost: colors.primary,
  success: colors.onPrimary,
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    borderRadius: radius['2xl'],
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  icon: { alignItems: 'center', justifyContent: 'center' },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  lg: { paddingVertical: spacing[5], minHeight: 52 },
  md: { paddingVertical: spacing[4], minHeight: 44 },
  sm: { paddingVertical: spacing[3], paddingHorizontal: spacing[4], minHeight: 36 },
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
  success: { backgroundColor: colors.success },
};
