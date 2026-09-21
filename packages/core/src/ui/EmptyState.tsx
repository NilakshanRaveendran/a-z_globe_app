import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@core/theme';
import { Button } from './Button';
import { Icon, type IconProps } from './Icon';
import { Text } from './Text';

export type EmptyStateProps = {
  icon?: IconProps['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 'inline' sits inside a section; 'page' fills the screen. */
  variant?: 'inline' | 'page';
};

/**
 * Shown when a list resolves to nothing.
 *
 * Distinguishing "loading" from "loaded but empty" matters: a skeleton that
 * never resolves reads as a hung app. Every list that can come back empty —
 * which is every Firestore-backed list before the catalogue is seeded — renders
 * this instead.
 */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  variant = 'inline',
}: EmptyStateProps) {
  return (
    <View style={[styles.base, variant === 'page' && styles.page]}>
      {icon ? (
        <View style={styles.iconWell}>
          <Icon name={icon} size={26} color={colors.textMuted} />
        </View>
      ) : null}

      <Text variant="h3" color={colors.textStrong} align="center">
        {title}
      </Text>

      {message ? (
        <Text variant="bodyLg" color={colors.textSecondary} align="center">
          {message}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    gap: spacing[2.5],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[8],
  },
  page: { flex: 1, justifyContent: 'center' },
  iconWell: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing[3],
  },
  action: { paddingHorizontal: spacing[9], marginTop: spacing[4] },
});
