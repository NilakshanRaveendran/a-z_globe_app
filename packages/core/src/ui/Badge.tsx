import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Text } from './Text';

export type BadgeTone = 'primary' | 'success' | 'neutral' | 'dark' | 'warning';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: ViewStyle;
};

/**
 * Small pill label — "BESTSELLER", "Open", "Closed", "New order", "Delivered".
 * Figma (FoodCard 324:1708): pad 2/8 · r:pill · Urbanist 700 9/13.5 ls0.22.
 */
export function Badge({ label, tone = 'primary', style }: BadgeProps) {
  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      <Text variant="badge" color={toneText[tone]}>
        {label}
      </Text>
    </View>
  );
}

const toneStyles: Record<BadgeTone, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  success: { backgroundColor: colors.success },
  neutral: { backgroundColor: colors.surfaceAlt },
  dark: { backgroundColor: 'rgba(0,0,0,0.55)' },
  warning: { backgroundColor: colors.status.warning },
};

const toneText: Record<BadgeTone, string> = {
  primary: colors.onPrimary,
  success: colors.onPrimary,
  neutral: colors.textSecondary,
  dark: colors.onPrimary,
  warning: colors.textStrong,
};

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
  },
});
