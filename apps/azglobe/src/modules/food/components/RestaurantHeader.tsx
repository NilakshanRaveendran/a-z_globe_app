import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { HeroTopBar } from './HeroTopBar';
import { formatDistance, formatPrepTime } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import type { Merchant } from '../types';
import { deliveryPriceLabel } from '../utils/deliveryLabels';

/**
 * Hero image + title block shared by all three restaurant tabs
 * (17:4787 / 18:5057 / 18:5218).
 *
 *   hero    282pt, image with a top-down scrim that fades into the white sheet
 *   back    36pt circle · #FFFFFF 90% · floating shadow · arrow 18, inset to
 *           the safe area (pad 10/16 under the status bar)
 *   title   Urbanist 700 20/30 #1F2937 + tagline 400 13/19.5 #6B7280
 *   rating  pill pad 5/10 · r:pill · #F3F4F6 · star 13 · "4.8" 600 13/19.5 ·
 *           "(234)" 400 12/18 #6B7280
 *   meta    row gap 14 · clock / bike / pin icons at 13 · 400 12/18 #6B7280
 */
export function RestaurantHeader({
  merchant,
  onBack,
}: {
  merchant: Merchant;
  onBack: () => void;
}) {

  return (
    <>
      <View style={styles.hero}>
        <Image
          source={resolveImage(merchant.coverImage)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
        {/* Figma fades the photo into the white content sheet rather than using
            a plain dark scrim. */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.50)',
            'rgba(0,0,0,0.10)',
            'rgba(192,192,192,0.32)',
            'rgba(242,242,242,0.77)',
            '#FAFAFA',
          ]}
          locations={[0, 0.5, 0.63, 0.88, 1]}
          style={StyleSheet.absoluteFill}
        />

        <HeroTopBar onBack={onBack} />
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text variant="h1" color={colors.text} numberOfLines={1}>
              {merchant.name}
            </Text>
            <Text variant="bodyRegular" color={colors.textSecondary} style={styles.tagline}>
              {merchant.tagline}
            </Text>
          </View>

          <View style={styles.ratingPill}>
            <Icon name="star" size={13} color={colors.star} />
            <Text variant="body" color={colors.text} style={styles.ratingValue}>
              {merchant.reviewCount > 0 ? merchant.rating.toFixed(1) : 'New'}
            </Text>
            {merchant.reviewCount > 0 ? (
              <Text variant="bodyRegular" color={colors.textSecondary}>
                ({merchant.reviewCount})
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <Meta icon="clock" label={formatPrepTime(merchant.prepTimeMin, merchant.prepTimeMax)} />
          <Meta
            icon="bike"
            label={deliveryPriceLabel(merchant)}
          />
          {merchant.distanceKm != null ? (
            <Meta icon="mapPin" label={formatDistance(merchant.distanceKm)} />
          ) : null}
        </View>
      </View>
    </>
  );
}

function Meta({ icon, label }: { icon: 'clock' | 'bike' | 'mapPin'; label: string }) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={13} color={colors.textMuted} />
      <Text variant="bodyRegular" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 282, backgroundColor: colors.surfaceAlt },
  pressed: { opacity: 0.8 },

  titleBlock: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[5],
    backgroundColor: colors.surface,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[4] },
  flex: { flex: 1 },
  // Figma: 13/19.5 at weight 400, sitting directly under the 20/30 title.
  tagline: { lineHeight: 20 },
  ratingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  ratingValue: { fontFamily: 'Urbanist_600SemiBold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[5], paddingTop: spacing[3.5] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
});
