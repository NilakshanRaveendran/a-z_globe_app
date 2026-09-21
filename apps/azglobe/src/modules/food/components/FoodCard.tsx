import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Icon, StarRow, Text } from '@core/ui';
import { colors, radius, shadows, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { resolveImage } from '../data/images';
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
};

/**
 * The 2-up dish card in "Popular Dishes" (Home 324:1708) and the restaurant
 * menu grid (17:4787).
 *
 * Figma: 174.5×272.5 · r16 · #FFF · shadow card
 *   image  174.5×120 (top corners only)
 *   body   pad 12 · gap 4
 *   footer row space-between align center · pad-top 4
 */
export function FoodCard({ item, onPress, onAdd, showMerchant = true }: FoodCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        <Image source={resolveImage(item.image)} style={styles.image} contentFit="cover" transition={150} />
        {item.isBestseller ? <Badge label="Bestseller" style={styles.badge} /> : null}
      </View>

      <View style={[styles.body, !showMerchant && styles.bodyTight]}>
        {showMerchant ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {item.merchantName}
          </Text>
        ) : null}
        <Text variant="cardTitle" color={colors.textStrong} numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="price" color={colors.primary}>
          {formatMoney(item.price)}
        </Text>
        <Text variant="captionTight" color={colors.textMuted} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <StarRow rating={item.rating} size={10} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to cart`}
            onPress={onAdd}
            hitSlop={6}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
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
  badge: { position: 'absolute', top: spacing[3], left: spacing[3] },
  body: { padding: spacing[4], gap: spacing[1.5] },
  // Figma 17:4787 uses pad 10/12/12/12 on the restaurant menu grid.
  bodyTight: { paddingTop: spacing[3.5] },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[1.5],
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
