import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { AZBadge } from '@core/ui/AZBadge';
import { Icon, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatPrepTime } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import type { Merchant } from '../types';
import { deliveryPriceLabel } from '../utils/deliveryLabels';

/**
 * A row on the "Featured on A-Z Globe" list — Figma 16:4256.
 *
 *   image   361×200 · r16 · offer ribbon pad 5/10 · r8 · #D42B2B · 700 11/16.5
 *   name    Urbanist 700 18/21.25 #1A1A1A
 *   meta    AZ badge 14 + "Rs. 80 Delivery Fee · 20–30 min" 400 12/18 #6B7280
 *   badge   star 13 + "Best Overall" 600 12/18 #1A1A1A
 *   divider 1px #F3F4F6
 *
 * A closed merchant greys the image and overlays "Currently Closed", and the
 * whole row dims. It still opens: the restaurant page shows when it opens
 * again and keeps its dishes out of the cart until then.
 */
export function FeaturedListRow({
  merchant,
  onPress,
  showDivider = true,
}: {
  merchant: Merchant;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const fee = deliveryPriceLabel(merchant, 'Delivery Fee');
  const badge = merchant.badges[0];
  const closed = !merchant.isOpen;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={closed ? `${merchant.name}, currently closed` : merchant.name}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={resolveImage(merchant.coverImage)}
          style={[StyleSheet.absoluteFill, closed && styles.closedImage]}
          contentFit="cover"
          transition={150}
        />

        {closed ? (
          <View style={styles.closedOverlay}>
            <Text variant="h3" color={colors.textInverse}>
              Currently Closed
            </Text>
          </View>
        ) : merchant.offerLabel ? (
          <View style={styles.ribbon}>
            <Icon name="zap" size={12} color={colors.onPrimary} />
            <Text variant="labelSm" color={colors.onPrimary} style={styles.ribbonLabel}>
              {merchant.offerLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.caption}>
        <Text
          variant="h2"
          color={closed ? colors.textMuted : colors.palette.ink}
          style={styles.name}
          numberOfLines={1}
        >
          {merchant.name}
        </Text>

        <View style={styles.metaRow}>
          <AZBadge size={14} />
          <Text variant="bodyRegular" color={closed ? colors.textMuted : colors.textSecondary}>
            {fee} · {formatPrepTime(merchant.prepTimeMin, merchant.prepTimeMax)}
          </Text>
        </View>

        {badge ? (
          <View style={styles.badgeRow}>
            <Icon name="star" size={13} color={closed ? colors.textMuted : colors.palette.ink} />
            <Text variant="label" color={closed ? colors.textMuted : colors.palette.ink}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      {showDivider ? <View style={styles.divider} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingTop: spacing[4] },
  pressed: { opacity: 0.92 },
  imageWrap: {
    height: 200,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  closedImage: { opacity: 0.4 },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbon: {
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ribbonLabel: { fontFamily: 'Urbanist_700Bold' },

  caption: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[3.5],
    paddingBottom: spacing[2.5],
  },
  // Figma sets this at 18/21.25 rather than the h2 preset's 18/27.
  name: { lineHeight: 21.25 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[1.5] },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[2] },
  divider: {
    height: 1,
    marginHorizontal: SCREEN_PADDING,
    marginTop: spacing[4],
    backgroundColor: colors.surfaceAlt,
  },
});
