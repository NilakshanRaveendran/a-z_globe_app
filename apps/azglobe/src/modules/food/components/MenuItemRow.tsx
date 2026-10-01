import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, StarRow, Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { resolveImage } from '../data/images';
import { useItemOffer } from '../hooks/useItemOffer';
import { OfferPrice, OfferTag } from './OfferPrice';
import type { MenuItem } from '../types';

/**
 * The horizontal dish row used by "Quick Add" (17:4787), All Menu Items
 * (26:10198) and the Dishes results on Search.
 *
 * Figma: row gap 12 · pad 14 vertical · 1px #F9FAFB bottom rule
 *   thumb  61.6 square · r15.4
 *   name   Urbanist 600 15/22.5 #1F2937
 *   desc   Urbanist 500 12/16.5 #6B7280, one line
 *   price  Urbanist 700 14/21 #D42B2B, then a 24pt gap before the stars
 *   add    28pt circular #D42B2B button on the right
 *
 * Sold out: greyed thumb and name, a "Sold out" tag instead of the stars, and a
 * disabled "+". `addDisabled` greys only the "+" (the restaurant is closed).
 */
export function MenuItemRow({
  item,
  onPress,
  onAdd,
  showDivider = true,
  addDisabled = false,
  subtitle,
}: {
  item: MenuItem;
  onPress: () => void;
  onAdd: () => void;
  showDivider?: boolean;
  addDisabled?: boolean;
  /** Replaces the description — Search shows the restaurant's name here. */
  subtitle?: string;
}) {
  const soldOut = item.available === false;
  const canAdd = !soldOut && !addDisabled;
  const offer = useItemOffer(soldOut ? null : item);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={soldOut ? `${item.name}, sold out` : item.name}
      style={({ pressed }) => [styles.row, showDivider && styles.divider, pressed && styles.pressed]}
    >
      <Image
        source={resolveImage(item.image)}
        style={[styles.thumb, soldOut && styles.soldOut]}
        contentFit="cover"
        transition={150}
      />

      <View style={styles.body}>
        <Text
          variant="h4"
          color={soldOut ? colors.textMuted : colors.text}
          style={styles.name}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1} style={styles.desc}>
          {subtitle ?? item.description}
        </Text>
        <View style={styles.priceRow}>
          <OfferPrice price={item.price} offer={offer} variant="h5" color={soldOut ? colors.textMuted : colors.primary} />
          {offer ? (
            <OfferTag offer={offer} />
          ) : soldOut ? (
            <View style={styles.soldOutTag}>
              <Text variant="captionBold" color={colors.textSecondary}>
                Sold out
              </Text>
            </View>
          ) : (
            <StarRow rating={item.rating} size={10} />
          )}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={soldOut ? `${item.name} is sold out` : `Add ${item.name} to cart`}
        accessibilityState={{ disabled: !canAdd }}
        disabled={!canAdd}
        onPress={onAdd}
        hitSlop={8}
        style={({ pressed }) => [styles.addButton, !canAdd && styles.addDisabled, pressed && styles.pressed]}
      >
        <Icon name="plusSm" size={14} color={colors.onPrimary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[5],
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceSunken },
  pressed: { opacity: 0.85 },
  thumb: { width: 61.6, height: 61.6, borderRadius: 15.4, backgroundColor: colors.surfaceAlt },
  soldOut: { opacity: 0.45 },
  body: { flex: 1 },
  name: { fontFamily: 'Urbanist_600SemiBold' },
  desc: { paddingTop: spacing[0.5], lineHeight: 16.5 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[9],
    paddingTop: spacing[2.5],
  },
  soldOutTag: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
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
