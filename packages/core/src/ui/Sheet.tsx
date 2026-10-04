import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MAX_WIDTH, colors, radius, spacing } from '@core/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Rendered as a bordered header row with a close button, as on "Pay with". */
  title?: string;
  children: ReactNode;
};

/**
 * Bottom sheet — Figma "Pay with" (416:3862) and "Write a Review" (426:3202).
 *
 *   panel  r24/28 top corners · #FFFFFF
 *   grip   40×4 pill · #E5E7EB, centred, 12pt from the top
 *   header (when titled) 20pt title, 40pt close button and balancing spacer
 *
 * A plain Modal rather than a gesture sheet: the design's sheets are static
 * panels with an explicit close, and this keeps them identical on both
 * platforms with no gesture-handler nesting to get wrong.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    entrance.setValue(0);
    if (visible) {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        if (!active) return;
        Animated.timing(entrance, { toValue: 1, duration: reduced ? 0 : 240, useNativeDriver: true }).start();
      });
    }
    return () => { active = false; entrance.stopAnimation(); };
  }, [visible, entrance]);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: entrance }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close popup" />
        </Animated.View>

        <Animated.View style={[styles.panel, {
          paddingBottom: spacing[6] + insets.bottom,
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [64, 0] }) }],
        }]}>
          <View style={styles.gripRow}>
            <View style={styles.grip} />
          </View>

          {title ? (
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <Icon name="close" size={18} color={colors.text} />
              </Pressable>
              <Text variant="h2" color={colors.text} style={styles.title}>
                {title}
              </Text>
              {/* Balances the close button so the title sits optically centred. */}
              <View style={{ width: 40 }} />
            </View>
          ) : null}

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Centred and capped to the app's column, so on a PC the sheet rises inside
  // the app rather than across the whole window.
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: {
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    maxHeight: '92%',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['5xl'],
    borderTopRightRadius: radius['5xl'],
  },
  gripRow: { alignItems: 'center', paddingTop: spacing[4], paddingBottom: spacing[1.5] },
  grip: { width: 40, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 28, flex: 1, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
