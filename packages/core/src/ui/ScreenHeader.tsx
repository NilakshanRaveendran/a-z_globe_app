import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Right-hand slot — the bell on Order Food, "Remove" on Address info. */
  action?: ReactNode;
  /** Order Food uses a plain chevron; Cart/Checkout use a circular grey button. */
  backStyle?: 'plain' | 'circle';
};

/**
 * Figma uses two header shapes. Order Food (31:11648) puts a bare chevron beside
 * a large title; Cart (414:2985) and Checkout (414:3339) use a 40pt circular grey
 * back button. Both are the same component with `backStyle`.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
  backStyle = 'plain',
}: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [
            backStyle === 'circle' ? styles.circle : styles.plain,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="arrowLeft" size={18} color={colors.textStrong} />
        </Pressable>
      ) : null}

      <View style={styles.titles}>
        <Text variant="h1" color={colors.textHeading}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color={colors.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[4],
  },
  titles: { flex: 1, gap: spacing[0.5] },
  plain: { paddingRight: spacing[0.5] },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  action: { alignItems: 'flex-end' },
  pressed: { opacity: 0.6 },
});
