import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, type TextProps } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import type { ItemOffer } from '../services/promotions';
import type { Money } from '../types';

/**
 * A dish's price with its offer: the price after the offer in brand red and
 * the original struck through beside it. No offer (or one that needs a
 * minimum order) shows the plain price.
 */
export function OfferPrice({
  price,
  offer,
  variant = 'price',
  color = colors.primary,
  style,
}: {
  price: Money;
  offer: ItemOffer | null;
  variant?: TextProps['variant'];
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const now = offer?.price ?? null;
  return (
    <View style={[styles.row, style]}>
      <Text variant={variant} color={color}>
        {formatMoney(now ?? price)}
      </Text>
      {now != null && now < price ? (
        <Text variant="captionRegular" color={colors.textMuted} style={styles.was}>
          {formatMoney(price)}
        </Text>
      ) : null}
    </View>
  );
}

/** The red "50% OFF" tag on an offered dish. */
export function OfferTag({ offer, style }: { offer: ItemOffer | null; style?: StyleProp<ViewStyle> }) {
  if (!offer) return null;
  return (
    <View style={[styles.tag, style]}>
      <Text variant="captionBold" color={colors.onPrimary} numberOfLines={1}>
        {offer.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], flexWrap: 'wrap' },
  was: { textDecorationLine: 'line-through' },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
