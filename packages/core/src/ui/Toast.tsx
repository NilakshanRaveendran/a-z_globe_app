import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '@core/theme';
import { Text } from './Text';

export type ToastOptions = {
  /** A single inline action, e.g. "View cart". */
  action?: { label: string; onPress: () => void };
  /** `error` draws the message in the brand red for failures. */
  tone?: 'default' | 'error';
  /** How long it stays up, in ms. Defaults to 2.6 s, 4 s with an action. */
  duration?: number;
};

type ToastState = ToastOptions & { id: number; message: string };

let nextId = 1;
// react-native-web has no native driver; asking for one only logs a warning.
const nativeDriver = Platform.OS !== 'web';
const listeners = new Set<(toast: ToastState) => void>();

/**
 * Brief, non-blocking feedback — "Added to cart", "Review posted". Anything
 * that needs a decision belongs in an `Alert`, not here.
 *
 * Needs one `<ToastHost />` mounted near the root (App.tsx).
 */
export function showToast(message: string, options: ToastOptions = {}): void {
  const toast = { ...options, id: nextId++, message };
  listeners.forEach((listener) => listener(toast));
}

/**
 * Renders the current toast above the tab bar: a dark #1F2937 pill, white
 * 500 13/19.5 text, the action in 700 red-tinted text. One at a time — a new
 * toast replaces the one on screen.
 */
export function ToastHost({ bottomOffset = 84 }: { bottomOffset?: number }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listener = (next: ToastState) => setToast(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: nativeDriver }).start();
    const hide = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: nativeDriver }).start(() =>
        setToast((current) => (current?.id === toast.id ? null : current))
      );
    }, toast.duration ?? (toast.action ? 4000 : 2600));
    return () => clearTimeout(hide);
  }, [toast, opacity]);

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: bottomOffset + insets.bottom }]}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { opacity }]}
      >
        <Text
          variant="body"
          color={toast.tone === 'error' ? colors.palette.red300 : colors.textInverse}
          style={styles.message}
        >
          {toast.message}
        </Text>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              toast.action?.onPress();
              setToast(null);
            }}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text variant="h5" color={colors.palette.red300}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing[6] },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    maxWidth: 420,
    width: '100%',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.text,
    ...shadows.floating,
  },
  message: { flex: 1 },
  pressed: { opacity: 0.6 },
});
