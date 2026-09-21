import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';

export type BottomBarProps = {
  children: ReactNode;
};

/**
 * Sticky action bar holding the primary CTA ("Add to Cart", "Go to Checkout",
 * "Place Order", "Save and continue").
 *
 * Figma (414:2985, 414:3339): pad 14v / 16h · #FFFFFF · 1px top border #F3F4F6.
 * The home-indicator inset is added on top so the button never sits under it.
 */
export function BottomBar({ children }: BottomBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: spacing[5] + insets.bottom }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing[5],
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
});
