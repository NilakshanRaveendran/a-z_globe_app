import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@core/theme';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  /** 'card' for content cards, 'none' for flat grouped rows. */
  elevation?: 'card' | 'raised' | 'none';
  padded?: boolean;
  style?: ViewStyle;
};

/**
 * White rounded surface used for dish cards, order summaries, review cards and
 * the grouped rows on Checkout.
 *
 * Figma: r16 · #FFFFFF · shadow 0 0 0 .5 6% + 0 2 8 9% · pad 16 (or 12 on the
 * compact dish card, which passes its own padding).
 */
export function Card({ children, onPress, elevation = 'card', padded = true, style }: CardProps) {
  const content = [styles.base, shadows[elevation], padded && styles.padded, style];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...content, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={content}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
  },
  padded: { padding: spacing[6] },
  pressed: { opacity: 0.92 },
});
