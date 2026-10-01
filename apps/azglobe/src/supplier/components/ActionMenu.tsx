import type { RefObject } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors, fontFamily, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { Icon, Text, type IconName } from '@core/ui';

/** Where the button that opened the menu sits, in window coordinates. */
export type MenuAnchor = { x: number; y: number; width: number; height: number };

export type ActionMenuItem = {
  label: string;
  icon: IconName;
  /** Drawn in the brand red — delete, hide, close. */
  destructive?: boolean;
  /** Greyed out and inert; say why in `hint`. */
  disabled?: boolean;
  /** A second line under the label, e.g. "Finish its 2 active orders first". */
  hint?: string;
  onPress: () => void;
};

/** Measure a button so the menu can open under it. */
export function measureAnchor(ref: RefObject<View | null>, open: (anchor: MenuAnchor) => void): void {
  ref.current?.measureInWindow((x, y, width, height) => open({ x, y, width, height }));
}

/**
 * The provider "⋮" popover — Figma 432:3456, first drawn for Reviews and
 * shared by every supplier action menu (a restaurant's ⋮, an offer's ⋮, the
 * Orders tab's restaurant picker) instead of a system alert.
 *
 *   panel  min 156 wide · #FFFFFF · 0.51px #F3F4F6 · r14 · shadow 0 8 24 12% +
 *          0 2 8 8% · opens 3 below the button, right-aligned to it, and flips
 *          above it when there is no room
 *   title  optional · pad 10/14 · 500 11/16.5 #9CA3AF · 0.5px #F3F4F6 rule
 *   item   pad 12/14 · 15pt icon gap 10 · 600 13/19.5 — #374151, or #D42B2B
 *          for the destructive ones · hint 400 11/16.5 #9CA3AF · 0.5px
 *          #F3F4F6 divider inset 14
 *
 * Choosing an item closes the menu first, then runs it — on iOS a beat later,
 * because iOS won't present the next modal (a sheet, a confirmation) while
 * this one is still fading out.
 */
export function ActionMenu({
  anchor,
  title,
  items,
  onClose,
}: {
  /** The menu is shown while this is set. */
  anchor: MenuAnchor | null;
  title?: string;
  items: ActionMenuItem[];
  onClose: () => void;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  if (!anchor) return null;

  const run = (item: ActionMenuItem) => () => {
    onClose();
    if (Platform.OS === 'ios') setTimeout(item.onPress, 350);
    else item.onPress();
  };

  const height =
    (title ? TITLE_HEIGHT : 0) + items.reduce((sum, item) => sum + (item.hint ? HINT_ITEM_HEIGHT : ITEM_HEIGHT), 0);
  const below = anchor.y + anchor.height + spacing[1];
  const top = Math.max(
    spacing[6],
    below + height > windowHeight - spacing[6] ? anchor.y - spacing[1] - height : below
  );
  const right = Math.max(SCREEN_PADDING, windowWidth - (anchor.x + anchor.width));
  const maxWidth = windowWidth - right - SCREEN_PADDING;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.menu, { top, right, maxWidth }]} accessibilityRole="menu">
        {title ? (
          <View style={styles.title}>
            <Text variant="micro" color={colors.textMuted} numberOfLines={2}>
              {title}
            </Text>
          </View>
        ) : null}
        {items.map((item, i) => {
          const tint = item.disabled
            ? colors.borderStrong
            : item.destructive
              ? colors.primary
              : colors.palette.gray700;
          return (
            <View key={i}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                accessibilityRole="menuitem"
                accessibilityState={{ disabled: !!item.disabled }}
                accessibilityHint={item.hint}
                disabled={item.disabled}
                onPress={run(item)}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <Icon name={item.icon} size={15} color={tint} />
                <View style={styles.itemText}>
                  <Text variant="body" color={tint} style={styles.label} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Text variant="microRegular" color={colors.textMuted} numberOfLines={2}>
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Modal>
  );
}

/** 12 + 19.5 + 12, plus the 0.5 divider — Figma 432:3457. */
const ITEM_HEIGHT = 44;
/** An item with a one-line hint under its label. */
const HINT_ITEM_HEIGHT = 61;
const TITLE_HEIGHT = 37;

const HAIRLINE = 0.51;

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  menu: {
    position: 'absolute',
    minWidth: 156,
    borderRadius: radius['2xl'],
    borderWidth: HAIRLINE,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.popover,
  },
  title: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceAlt,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3.5],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  itemPressed: { backgroundColor: colors.surfaceSunken },
  itemText: { flexShrink: 1 },
  label: { fontFamily: fontFamily[600] },
  divider: {
    height: 0.5,
    marginHorizontal: spacing[5],
    backgroundColor: colors.surfaceAlt,
  },
});
