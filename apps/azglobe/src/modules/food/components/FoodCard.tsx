import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Icon, StarRow, Text } from '@core/ui';
import { colors, radius, shadows, spacing } from '@core/theme';
import { resolveImage } from '../data/images';
import { useItemOffer } from '../hooks/useItemOffer';
import { OfferPrice, OfferTag } from './OfferPrice';
import type { MenuItem } from '../types';

export type FoodCardProps = {
  item: MenuItem;
  onPress: () => void;
  onAdd: () => void;
  /**
   * Home shows the merchant above the dish name; the restaurant menu grid does
   * not (you are already on that restaurant) and tightens its top padding.
   */
  showMerchant?: boolean;
  /** The restaurant is closed: the card still opens, the "+" does not add. */
  addDisabled?: boolean;
};

/**
 * The 2-up dish card in "Popular Dishes" (Home 324:1708) and the restaurant
 * menu grid (17:4787).
 *
 * Figma: 174.5×272.5 (Home) / 173×251.5 (menu grid) · r16 · #FFF · shadow card
 *   image  120 tall (top corners only)
 *   body   pad 12 (10/12/12/12 on the grid) · gap 4 → 152.5 / 131.5 tall
 *   footer row space-between align center · pad-top 4
 *
 * A dish the restaurant marked unavailable is greyed with a "Sold out" pill in
 * place of "Bestseller" and a disabled "+".
 */
export function FoodCard({ item, onPress, onAdd, showMerchant = true, addDisabled = false }: FoodCardProps) {
  const soldOut = item.available === false;
  const canAdd = !soldOut && !addDisabled;
  // The restaurant's running offer on this dish — what the cart will take off.
  const offer = useItemOffer(soldOut ? null : item);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={soldOut ? `${item.name}, sold out` : item.name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={resolveImage(item.image)}
          style={[styles.image, soldOut && styles.soldOutImage]}
          contentFit="cover"
          transition={150}
        />
        {soldOut ? (
          <Badge label="Sold out" tone="dark" style={styles.badge} />
        ) : item.isBestseller ? (
          <Badge label="Bestseller" style={styles.badge} />
        ) : null}
        <OfferTag offer={offer} style={styles.offerTag} />
      </View>

      <View style={[styles.body, showMerchant ? styles.bodyHome : styles.bodyTight]}>
        {showMerchant ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {item.merchantName}
          </Text>
        ) : null}
        <Text variant="cardTitle" color={soldOut ? colors.textMuted : colors.textStrong} numberOfLines={1}>
          {item.name}
        </Text>
        <OfferPrice price={item.price} offer={offer} color={soldOut ? colors.textMuted : colors.primary} />
        <Text variant="captionTight" color={colors.textMuted} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <StarRow rating={item.rating} size={16} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={soldOut ? `${item.name} is sold out` : `Add ${item.name} to cart`}
            accessibilityState={{ disabled: !canAdd }}
            disabled={!canAdd}
            onPress={(event) => {
              event.stopPropagation();
              onAdd();
            }}
            hitSlop={6}
            style={({ pressed }) => [styles.addButton, !canAdd && styles.addDisabled, pressed && styles.pressed]}
          >
            <Icon name="plusSm" size={14} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    ...shadows.card,
  },
  pressed: { opacity: 0.92 },
  imageWrap: { height: 120, backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  soldOutImage: { opacity: 0.45 },
  badge: { position: 'absolute', top: spacing[3], left: spacing[3] },
  offerTag: { position: 'absolute', top: spacing[3], right: spacing[3] },
  body: { padding: spacing[4], gap: spacing[1.5] },
  // Home: the merchant line makes the body 152.5 tall (Figma 324:1708).
  bodyHome: { minHeight: 152 },
  // Menu grid: pad 10/12/12/12 and no merchant line — 131.5 tall (17:4787).
  bodyTight: { paddingTop: spacing[3.5], minHeight: 131 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[1.5],
    marginTop: 'auto',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  addDisabled: { backgroundColor: colors.borderStrong },
});
