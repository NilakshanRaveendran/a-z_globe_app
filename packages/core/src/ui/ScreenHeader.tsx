import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { BackButton, HEADER_BUTTON_SIZE } from './HeaderButton';
import { Text } from './Text';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Right-hand slot — bell and cart (HeaderButtonRow), "Remove" on Address info. */
  action?: ReactNode;
};

/**
 * The standard header: the shared 40pt back button (BackButton), the title
 * beside it, and an optional right-hand slot. Cart (414:2985) and Checkout
 * (414:3339) set the shape; every screen with a back button now uses it.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
}: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack ? <BackButton onPress={onBack} /> : null}

      <View style={styles.titles}>
        <Text variant="h1" color={colors.textHeading} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Buttons sit on the top line, 12 below the safe area, on every screen —
  // a subtitle grows the title block downward instead of shifting them.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[4],
  },
  titles: { flex: 1, minWidth: 0, minHeight: HEADER_BUTTON_SIZE, justifyContent: 'center', gap: spacing[0.5] },
  action: { alignItems: 'flex-end' },
});
