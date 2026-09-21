import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { formatPrepTime } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import type { Merchant } from '../types';

/**
 * "Top Spots Near You" tile on the Order Food landing page.
 *
 * Figma (31:11648): 175.74×131.8 · r14 · scrim #000 65%→10%→0% · caption pad 10
 *   name  Urbanist 700 13/16.25 #FFFFFF centred
 *   meta  star 10 · "4.8" 600 11/16.5 · "·" 40% · "20–30 min" 500 10/15 80%
 *
 * A closed merchant is greyed with a "Currently Closed" overlay (see 16:4256).
 */
export function TopSpotTile({ merchant, onPress }: { merchant: Merchant; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <Image
        source={resolveImage(merchant.coverImage)}
        style={[StyleSheet.absoluteFill, !merchant.isOpen && styles.closedImage]}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {!merchant.isOpen ? (
        <View style={styles.closedOverlay}>
          <Text variant="h5" color={colors.textInverse} align="center">
            Closed
          </Text>
        </View>
      ) : null}

      <View style={styles.caption}>
        <Text variant="body" color={colors.textInverse} align="center" numberOfLines={1} style={styles.name}>
          {merchant.name}
        </Text>
        <View style={styles.meta}>
          <Icon name="star" size={10} color={colors.star} />
          <Text variant="labelSm" color={colors.textInverse}>
            {merchant.reviewCount > 0 ? merchant.rating.toFixed(1) : 'New'}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.40)">
            ·
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.80)">
            {formatPrepTime(merchant.prepTimeMin, merchant.prepTimeMax)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 175.74 / 131.8,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.92 },
  closedImage: { opacity: 0.45 },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { padding: spacing[3.5] },
  name: { lineHeight: 16.25, fontFamily: 'Urbanist_700Bold' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingTop: spacing[0.5],
  },
});
