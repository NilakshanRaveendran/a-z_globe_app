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
 * A closed merchant (31:11648, Trinco Blu): the whole tile at 50% opacity and a
 * 45×21 "Closed" pill top-right — pad 3/7 · r:pill · #000 60% · 600 10/15 #FFF.
 */
export function TopSpotTile({ merchant, onPress }: { merchant: Merchant; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={merchant.isOpen ? merchant.name : `${merchant.name}, closed`}
      style={({ pressed }) => [styles.tile, !merchant.isOpen && styles.closed, pressed && styles.pressed]}
    >
      <Image
        source={resolveImage(merchant.coverImage)}
        style={StyleSheet.absoluteFill}
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
        <View style={styles.closedPill}>
          <Text variant="captionBold" color={colors.textInverse}>
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
  closed: { opacity: 0.5 },
  closedPill: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    paddingHorizontal: 7,
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.60)',
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
