import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fontFamily, SCREEN_PADDING, spacing } from '@core/theme';
import { BackButton, Text } from '@core/ui';

/**
 * The stacked header on the provider order and offer pages — Active Orders
 * (338:1961), Order History (346:3754), Offers & Discounts (352:6743) and
 * Reviews (385:5924); the Orders tab reuses it without the back button.
 *
 *   pad      23 top · 16 bottom · 16 sides · #FFFFFF
 *   back     BackButton — the shared 40pt circle every screen uses
 *   title    Urbanist 700 22/33 #1F2937, 12 above
 *   subtitle restaurant name 400 13/19.5 #D42B2B, 2 above
 *
 * Every prop but `title` is optional; `onBack`, `action` and `bordered` were
 * added for the Orders tab and leave the existing callers unchanged.
 */
export function SupplierHeader({
  title,
  subtitle,
  onBack,
  action,
  bordered = false,
  children,
}: {
  title: string;
  /** A string (the restaurant name), or rich text. */
  subtitle?: ReactNode;
  /** Omit on a tab root, where there is nowhere to go back to. */
  onBack?: () => void;
  /** Sits on the right of the back row, e.g. a "History" pill. */
  action?: ReactNode;
  /** A 0.51pt #F3F4F6 rule under the block. Off by default, as on the frames. */
  bordered?: boolean;
  /** Anything that belongs inside the header block, under the titles. */
  children?: ReactNode;
}) {
  return (
    <View style={[styles.wrap, bordered && styles.bordered]}>
      {onBack || action ? (
        <View style={styles.row}>
          {onBack ? (
            <BackButton onPress={onBack} />
          ) : (
            <View />
          )}
          {action ?? null}
        </View>
      ) : null}
      <Text
        variant="pageTitle"
        color={colors.text}
        style={onBack || action ? styles.title : undefined}
      >
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
    // The same 12 above the back row as every other header.
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  bordered: { borderBottomWidth: 0.51, borderBottomColor: colors.surfaceAlt },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: spacing[4] },
  subtitle: { marginTop: spacing[0.5], fontFamily: fontFamily[400] },
});
