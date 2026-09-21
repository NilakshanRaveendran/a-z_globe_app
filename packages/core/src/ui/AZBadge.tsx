import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@core/theme';
import { Text } from './Text';

/**
 * The small red "AZ" mark that prefixes A-Z Globe delivery metadata on the
 * Featured cards.
 *
 * Figma (31:11648): 13×13 · r3 · #D42B2B · label Urbanist 900 6/6 #FFFFFF.
 */
export function AZBadge({ size = 13, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View style={[styles.badge, { width: size, height: size }, style]}>
      <Text variant="caption" color={colors.onPrimary} style={[styles.label, { fontSize: size * 0.46 }]}>
        AZ
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    backgroundColor: colors.primary,
  },
  label: { fontFamily: 'Urbanist_900Black', lineHeight: 6 },
});
