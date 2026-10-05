import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Icon, Text } from '@core/ui';
import { colors, radius, shadows, spacing } from '@core/theme';

/**
 * The map panel on Checkout, Address info and the restaurant Info tab.
 *
 * Figma draws a stylised grey grid with a red pin and an address chip rather
 * than a live map (17:4787 / 400:4244 / 414:3339), so this reproduces that
 * exactly. Swapping in react-native-maps later means replacing only this file.
 *
 * `onDirections` adds the Info tab's pill (18:5218): bottom-right, 14 radius,
 * #FFF with a #FFE2E2 hairline and the floating shadow, a navigation glyph 11
 * and "Directions" Urbanist 700 11/16.5 #D42B2B, pad 6/12.
 */
export function MapPreview({
  label,
  height = 180,
  onDirections,
  style,
}: {
  label?: string;
  height?: number;
  onDirections?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.map, { height }, style]}>
      {/* Grid lines, matching the design's two vertical and two horizontal rules. */}
      <View style={[styles.gridV, { left: '28%' }]} />
      <View style={[styles.gridV, { left: '68%' }]} />
      <View style={[styles.gridH, { top: '34%' }]} />
      <View style={[styles.gridH, { top: '72%' }]} />

      <View style={styles.pinWrap}>
        <View style={styles.pin}>
          <Icon name="mapPin" size={14} color={colors.primary} />
        </View>
        <View style={styles.pinStem} />
      </View>

      {label ? (
        <View style={styles.chip}>
          <Icon name="mapPin" size={12} color={colors.primary} />
          <Text variant="bodySm" color={colors.textStrong} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}

      {onDirections ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Get directions"
          onPress={onDirections}
          style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
        >
          <Icon name="navigation" size={11} color={colors.primary} />
          <Text variant="labelSm" color={colors.primary} style={styles.directionsLabel}>
            Directions
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    backgroundColor: '#E9ECF0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 4, backgroundColor: colors.surface },
  gridH: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: colors.surface },
  pinWrap: { alignItems: 'center' },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pinStem: { width: 2, height: 12, backgroundColor: colors.primary },
  chip: {
    position: 'absolute',
    bottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    maxWidth: '88%',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  directions: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius['2xl'],
    borderWidth: 0.54,
    borderColor: colors.primaryOutline,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  directionsLabel: { fontFamily: 'Urbanist_700Bold' },
  pressed: { opacity: 0.85 },
});
