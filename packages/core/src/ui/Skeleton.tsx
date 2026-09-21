import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, radius } from '@core/theme';

export type SkeletonProps = {
  width?: ViewStyle['width'];
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Loading placeholder. Every list in the app shows skeletons rather than a
 * spinner, so the layout does not jump when data lands.
 */
export function Skeleton({ width = '100%', height = 12, borderRadius = radius.md, style }: SkeletonProps) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View style={[styles.base, { width, height, borderRadius }, animated, style]} />;
}

/** Non-animated block, for composing bigger skeleton shapes. */
export function SkeletonBlock({ style }: { style?: ViewStyle }) {
  return <View style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceAlt },
});
