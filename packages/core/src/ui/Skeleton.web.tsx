import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius } from '@core/theme';

export type SkeletonProps = {
  width?: ViewStyle['width'];
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Loading placeholder — web. The same 0.4 ↔ 0.85 pulse as the native one
 * (Skeleton.tsx), driven by React Native's Animated so the web bundle does not
 * need Reanimated just for this.
 */
export function Skeleton({ width = '100%', height = 12, borderRadius = radius.md, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.base, { width, height, borderRadius, opacity: pulse }, style]} />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceAlt },
});
