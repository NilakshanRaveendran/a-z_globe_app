import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, StarRow, Text } from '@core/ui';
import { colors, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import type { MenuItem } from '../types';

/**
 * The horizontal dish row used by "Quick Add" (17:4787) and All Menu Items
 * (26:10198).
 *
 * Figma: row gap 12 · pad 14 vertical · 1px #F9FAFB bottom rule
 *   thumb  61.6 square · r15.4
 *   name   Urbanist 600 15/22.5 #1F2937
 *   desc   Urbanist 500 12/16.5 #6B7280, one line
 *   price  Urbanist 700 14/21 #D42B2B, then a 24pt gap before the stars
 *   add    28pt circular #D42B2B button on the right
 */
export function MenuItemRow({
  item,
  onPress,
  onAdd,
  showDivider = true,
}: {
  item: MenuItem;
  onPress: () => void;
  onAdd: () => void;
  showDivider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, showDivider && styles.divider, pressed && styles.pressed]}
    >
      <Image source={resolveImage(item.image)} style={styles.thumb} contentFit="cover" transition={150} />

      <View style={styles.body}>
        <Text variant="h4" color={colors.text} style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1} style={styles.desc}>
          {item.description}
        </Text>
        <View style={styles.priceRow}>
          <Text variant="h5" color={colors.primary}>
            {formatMoney(item.price)}
          </Text>
          <StarRow rating={item.rating} size={10} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${item.name} to cart`}
        onPress={onAdd}
        hitSlop={8}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
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
  body: { flex: 1 },
  name: { fontFamily: 'Urbanist_600SemiBold' },
  desc: { paddingTop: spacing[0.5], lineHeight: 16.5 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[9],
    paddingTop: spacing[2.5],
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
