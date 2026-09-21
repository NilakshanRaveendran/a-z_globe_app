import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@core/theme';
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
 *   header (when titled) pad 14/20 · 1px #F3F4F6 rule · 36pt close button ·
 *          title Urbanist 700 17/25.5, optically centred by a 36pt spacer
 *
 * A plain Modal rather than a gesture sheet: the design's sheets are static
 * panels with an explicit close, and this keeps them identical on both
 * platforms with no gesture-handler nesting to get wrong.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.panel, { paddingBottom: spacing[12] + insets.bottom }]}>
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
              <View style={styles.close} />
            </View>
          ) : null}

          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  panel: {
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
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  // Figma sets this at 17/25.5.
  title: { fontSize: 17, lineHeight: 25.5 },
  pressed: { opacity: 0.6 },
});
