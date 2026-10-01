import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { AZBadge } from '@core/ui/AZBadge';
import { Icon, Text } from '@core/ui';
import { colors, gradients, radius, spacing } from '@core/theme';
import { formatPrepTime } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import type { Merchant } from '../types';
import { deliveryPriceLabel } from '../utils/deliveryLabels';

/**
 * The large "Featured on A-Z Globe" card on the Order Food landing page.
 *
 * Figma (31:11648): 361×210 · r18 · scrim #000 75%→20%→0% · body pad 14
 *   rating pill  pad 3/8 · r:pill · #FFFFFF 20% · star 11 · "4.8" 600 11/16.5 ·
 *                "(234+)" 400 11/16.5 white 70%
 *   name         Urbanist 700 20/25 #FFFFFF
 *   meta row     AZ badge · "20–30 min" · "·" · "Rs. 80 delivery" (400 12/18 80%)
 */
export function FeaturedCard({ merchant, onPress }: { merchant: Merchant; onPress: () => void }) {
  const delivery = deliveryPriceLabel(merchant);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image
        source={resolveImage(merchant.coverImage)}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={gradients.imageScrimSoft}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.body}>
        {/*
          A restaurant nobody has reviewed has no average. Rendering 0.0 there
          reads as a bad score rather than an absent one, and a brand-new
          restaurant would look worse than a mediocre one.
        */}
        <View style={styles.ratingPill}>
          <Icon name="star" size={11} color={colors.star} />
          {merchant.reviewCount > 0 ? (
            <>
              <Text variant="labelSm" color={colors.textInverse}>
                {merchant.rating.toFixed(1)}
              </Text>
              <Text variant="microRegular" color="rgba(255,255,255,0.70)">
                ({merchant.reviewCount}+)
              </Text>
            </>
          ) : (
            <Text variant="microRegular" color="rgba(255,255,255,0.70)">
              New
            </Text>
          )}
        </View>

        <Text variant="h1" color={colors.textInverse} style={styles.name} numberOfLines={1}>
          {merchant.name}
        </Text>

        <View style={styles.meta}>
          <AZBadge />
          <Text variant="bodyRegular" color="rgba(255,255,255,0.80)">
            {formatPrepTime(merchant.prepTimeMin, merchant.prepTimeMax)}
          </Text>
          <Text variant="bodyRegular" color="rgba(255,255,255,0.30)">
            ·
          </Text>
          <Text variant="bodyRegular" color="rgba(255,255,255,0.80)">
            {delivery}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 210,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.92 },
  body: { padding: spacing[5], gap: spacing[1.5] },
  ratingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  // Figma sets this title to 20/25 rather than the h1 preset's 20/30.
  name: { lineHeight: 25 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingTop: spacing[1.5],
  },
});
