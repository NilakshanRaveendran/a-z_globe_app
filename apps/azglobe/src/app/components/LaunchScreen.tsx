import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { colors } from '@core/theme';

/** Native animated handoff from the static OS launch image. */
export function LaunchScreen({ ready = false, onFinish }: { ready?: boolean; onFinish?: () => void }) {
  const enter = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [entered, setEntered] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!live) return;
      reduced.current = value;
      Animated.timing(enter, { toValue: 1, duration: value ? 0 : 650, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (live && finished) setEntered(true); });
    });
    return () => { live = false; enter.stopAnimation(); };
  }, [enter]);
  useEffect(() => {
    if (!ready || !entered || !onFinish) return;
    Animated.timing(fade, { toValue: 0, duration: reduced.current ? 0 : 220, useNativeDriver: true })
      .start(({ finished }) => { if (finished) onFinish(); });
    return () => fade.stopAnimation();
  }, [ready, entered, fade, onFinish]);
  return <Animated.View style={[styles.screen, { opacity: fade }]} accessible accessibilityRole="progressbar" accessibilityLabel="Loading A-Z Globe">
    <Animated.View style={{ opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
      <Image source={require('../../../../../packages/core/assets/brand/az-lockup.png')} style={styles.logo} resizeMode="contain" />
    </Animated.View>
    <View style={styles.track}><Animated.View style={[styles.line, { transform: [{ scaleX: enter }] }]} /></View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  logo: { width: 180, height: 180 },
  track: { position: 'absolute', top: '50%', marginTop: 124, width: 48, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.primaryTint },
  line: { width: 48, height: 3, backgroundColor: colors.primary, borderRadius: 2 },
});
