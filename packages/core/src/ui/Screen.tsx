import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@core/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Defaults to top only — most screens have their own sticky bottom bar. */
  edges?: readonly Edge[];
  backgroundColor?: string;
  style?: ViewStyle;
};

/**
 * Screen frame. The Figma canvas is 393pt wide with a 50pt status bar drawn in;
 * that bar is the real device status bar, so we honour the safe-area inset here
 * rather than reproducing it.
 */
export function Screen({
  children,
  edges = ['top'],
  backgroundColor = colors.background,
  style,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor }, style]}>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
