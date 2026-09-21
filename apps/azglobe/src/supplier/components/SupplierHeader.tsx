import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fontFamily, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { Icon, Text } from '@core/ui';

/**
 * The stacked header on the provider pages — Order History (346:2826),
 * Offers & Discounts (352:6743) and Reviews (385:5924).
 *
 *   pad      23 top · 16 bottom · 16 sides · #FFFFFF
 *   back     36pt #F3F4F6 circle, 8×14 chevron
 *   title    Urbanist 700 22/33 #1F2937, 12 above
 *   subtitle restaurant name 400 13/19.5 #D42B2B, 2 above
 */
export function SupplierHeader({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Anything that belongs inside the header block, under the titles. */
  children?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="chevronLeft" size={14} color={colors.text} />
      </Pressable>
      <Text variant="pageTitle" color={colors.text} style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color={colors.primary} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 23,
    paddingBottom: spacing[6],
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: spacing[4] },
  subtitle: { marginTop: spacing[0.5], fontFamily: fontFamily[400] },
  pressed: { opacity: 0.6 },
});
