import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { BackButton, Icon, Text } from '@core/ui';
import { colors, fontFamily, SCREEN_PADDING, spacing } from '@core/theme';

/**
 * The provider page header — Restaurant Management (385:3425), and the same
 * block on the hub, Menu Management, Active Orders and Restaurant Information.
 *
 *   pad      12 top (as every header) · 16 bottom · 16 sides · #FFFFFF · 0.51px #E5E7EB rule
 *   back     BackButton — the shared 40pt circle every screen uses
 *   action   right of the back button (Add Restaurant, Add Item)
 *   title    Urbanist 700 24/36 #1F2937, 10 above
 *   subtitle Urbanist 500 13/19.5 #6B7280, 2 above
 */
export function SupplierPageHeader({
  title,
  subtitle,
  action,
  onBack,
  titleColor = colors.text,
  subtitleColor = colors.textSecondary,
  titleStyle,
  bordered = true,
  children,
}: {
  title: string;
  /** A string, or rich text such as "Manage your <b>Mama's Kitchen</b> menu". */
  subtitle?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  titleColor?: string;
  subtitleColor?: string;
  titleStyle?: StyleProp<TextStyle>;
  bordered?: boolean;
  /** Anything that belongs inside the header block, under the titles. */
  children?: ReactNode;
}) {
  return (
    <View style={[styles.header, bordered && styles.bordered]}>
      {onBack || action ? (
        <View style={styles.row}>
          {onBack ? (
            <BackButton onPress={onBack} />
          ) : <View />}
          {action ?? null}
        </View>
      ) : null}
      <Text variant="display" color={titleColor} style={[styles.title, titleStyle]}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color={subtitleColor} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** The red pill on the right of the back row — "Add Restaurant", "Add Item" (385:3640). */
export function SupplierHeaderAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon name="plus" size={13} color={colors.onPrimary} />
      <Text variant="label" color={colors.onPrimary} style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    // The same 12 above the back row as every other header.
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    paddingHorizontal: SCREEN_PADDING,
  },
  bordered: { borderBottomWidth: 0.51, borderBottomColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: spacing[3.5] },
  subtitle: { marginTop: spacing[0.5] },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  actionLabel: { fontFamily: fontFamily[700] },
  pressed: { opacity: 0.6 },
});
