import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { AZBadge } from '@core/ui/AZBadge';
import { Icon, Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { formatMoney, formatPrepTime } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import type { Merchant } from '../types';
import { deliveryPriceLabel } from '../utils/deliveryLabels';

/**
 * The 2-up featured tile under the big card on the Order Food landing page.
 *
 * Figma (31:11648): image 175.74 square · r14 · scrim #000 40%→0%
 *   offer ribbon  pad 3/7 · r6 · #D42B2B · Urbanist 700 10/15
 *   rating pill   pad 2/6 · r:pill · #000 40% · star 9 · 600 10/15
 *   caption block pad 8/0/2/0
 *     name   Urbanist 700 13/16.25 #1A1A1A
 *     row    AZ badge 11 + "25–35 min" 400 10/15 #6B7280
 *     row    "(512+)" #9CA3AF · "·" #E5E7EB · "#2 North" #6B7280 · chevron 9
 */
export function FeaturedTile({ merchant, onPress }: { merchant: Merchant; onPress: () => void }) {
  const rank = merchant.badges[0];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        <Image
          source={resolveImage(merchant.coverImage)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.40)', 'rgba(0,0,0,0)']}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        {merchant.offerLabel ? (
          <View style={styles.ribbon}>
            <Text variant="captionBold" color={colors.onPrimary} numberOfLines={1}>
              {merchant.offerLabel}
            </Text>
          </View>
        ) : null}

        <View style={styles.ratingPill}>
          <Icon name="star" size={16} color={colors.star} />
          <Text variant="captionBold" color={colors.textInverse}>
            {merchant.reviewCount > 0 ? merchant.rating.toFixed(1) : 'New'}
          </Text>
        </View>
      </View>

      <View style={styles.caption}>
        <Text variant="body" color={colors.palette.ink} numberOfLines={1} style={styles.name}>
          {merchant.name}
        </Text>

        <View style={styles.metaRow}>
          <AZBadge size={11} />
          <Text variant="captionRegular" color={colors.textSecondary}>
            {formatPrepTime(merchant.prepTimeMin, merchant.prepTimeMax)}
          </Text>
        </View>

        <View style={styles.metaRowTight}>
          <Text variant="captionRegular" color={colors.textMuted}>
            {merchant.reviewCount > 0 ? `(${merchant.reviewCount}+)` : 'No reviews yet'}
          </Text>
          <Text variant="captionRegular" color={colors.border}>
            ·
          </Text>
          <Text variant="captionRegular" color={colors.textSecondary} numberOfLines={1}>
            {rank ?? (merchant.deliveryRules ? deliveryPriceLabel(merchant) : formatMoney(merchant.deliveryFee))}
          </Text>
          <Icon name="chevronRight" size={9} color={colors.palette.ink} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1 },
  pressed: { opacity: 0.92 },
  imageWrap: {
    aspectRatio: 1,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  ribbon: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    paddingHorizontal: spacing[1.5] + 3,
    paddingVertical: spacing[1],
    borderRadius: radius.sm + 1,
    backgroundColor: colors.primary,
  },
  ratingPill: {
    position: 'absolute',
    bottom: spacing[3],
    left: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  caption: { paddingTop: spacing[3], paddingBottom: spacing[0.5] },
  // Figma tightens this to 13/16.25.
  name: { lineHeight: 16.25, fontFamily: 'Urbanist_700Bold' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingTop: spacing[1],
  },
  metaRowTight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
    paddingTop: spacing[0.5],
  },
});
