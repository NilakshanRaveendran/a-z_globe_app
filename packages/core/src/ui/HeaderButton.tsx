import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadows, spacing } from '@core/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';

/** Every header control — back, bell, cart, profile — is this size. */
export const HEADER_BUTTON_SIZE = 40;
export const HEADER_ICON_SIZE = 20;
/** Space between neighbouring header buttons (bell · cart). */
export const HEADER_BUTTON_GAP = spacing[3];

export type HeaderButtonTone = 'solid' | 'overlay';

export type HeaderButtonProps = {
  icon: IconName;
  /** Read by screen readers — "Go back", "My orders", "Cart, 2 items". */
  label: string;
  onPress: () => void;
  /**
   * 'solid'   #F3F4F6 circle, for white headers (Home, Order Food, Cart…)
   * 'overlay' frosted white circle with the floating shadow, over a photo
   *           (restaurant, dish), so it reads on any image
   */
  tone?: HeaderButtonTone;
  /** A count (cart) or a dot (an order on its way). 0 / false draws nothing. */
  badge?: number | boolean;
  /** Scales the glyph — CartButton's bump when something is added. */
  iconScale?: Animated.Value;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * The one round header button. Sharing it is the point: every screen's back
 * button, bell and cart are the same 40pt circle with a 20pt glyph, in the
 * same place, drawn by the same component.
 */
export function HeaderButton({
  icon,
  label,
  onPress,
  tone = 'solid',
  badge,
  iconScale,
  disabled,
  style,
  children,
}: HeaderButtonProps) {
  const glyph = <Icon name={icon} size={HEADER_ICON_SIZE} color={colors.palette.ink} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        tone === 'overlay' ? styles.overlay : styles.solid,
        pressed && styles.pressed,
        style,
      ]}
    >
      {iconScale ? <Animated.View style={{ transform: [{ scale: iconScale }] }}>{glyph}</Animated.View> : glyph}
      {typeof badge === 'number' && badge > 0 ? (
        <View style={styles.count}>
          <Text variant="micro" color={colors.onPrimary} style={styles.countText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : badge === true ? (
        <View style={styles.dot} />
      ) : null}
      {children}
    </Pressable>
  );
}

/** The back button — arrow, same circle as every other header button. */
export function BackButton({
  onPress,
  tone,
  label = 'Go back',
  style,
}: {
  onPress: () => void;
  tone?: HeaderButtonTone;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <HeaderButton icon="arrowLeft" label={label} onPress={onPress} tone={tone} style={style} />;
}

/** Bell, cart and the like, side by side with the standard gap. */
export function HeaderButtonRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    borderRadius: HEADER_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  solid: { backgroundColor: colors.surfaceAlt },
  overlay: { backgroundColor: colors.glassLight, ...shadows.floating },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: HEADER_BUTTON_GAP },
  count: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  countText: { fontSize: 10, lineHeight: 12 },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.palette.red500,
    borderWidth: 1,
    borderColor: colors.surface,
  },
});
