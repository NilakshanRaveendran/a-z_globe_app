import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { formatKm, type DeliveryQuote } from '../services/deliveryPricing';

/**
 * Why delivery can't be priced or reached for the chosen address, with the
 * one action that fixes it. Renders nothing when delivery is fine.
 *
 *   outOfRange    "Delivers within 5 km — this address is 7.2 km away."
 *                 → Change address (takeaway is already selected)
 *   needsPin      "Priced by distance — pin this address." → Pin address
 *   needsAddress  "Add a delivery address to see the fee." → Add address
 */
export function DeliveryAreaNotice({
  quote,
  merchantName,
  onChangeAddress,
  onPin,
  onAddAddress,
}: {
  quote: DeliveryQuote | null | undefined;
  merchantName: string;
  onChangeAddress: () => void;
  onPin: () => void;
  onAddAddress: () => void;
}) {
  if (!quote || quote.ok) return null;
  const copy =
    quote.reason === 'outOfRange'
      ? {
          icon: 'warning' as const,
          text: `${merchantName} delivers within ${formatKm(quote.maxKm ?? 0)} km — this address is ${formatKm(
            quote.distanceKm ?? 0
          )} km away. Pick it up as takeaway, or choose a closer address.`,
          action: 'Change address',
          onPress: onChangeAddress,
        }
      : quote.reason === 'needsPin'
        ? {
            icon: 'mapPin' as const,
            text: `${merchantName} charges delivery by distance. Pin this address on the map so we can work out the fee.`,
            action: 'Pin address',
            onPress: onPin,
          }
        : {
            icon: 'mapPin' as const,
            text: 'Add a delivery address to see the delivery fee.',
            action: 'Add address',
            onPress: onAddAddress,
          };

  return (
    <View accessibilityRole="alert" style={styles.box}>
      <Icon name={copy.icon} size={16} color={colors.primary} />
      <View style={styles.flex}>
        <Text variant="bodySm" color={colors.text}>
          {copy.text}
        </Text>
        <Pressable accessibilityRole="button" onPress={copy.onPress} hitSlop={8} style={styles.action}>
          <Text variant="label" color={colors.primary}>
            {copy.action}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
  },
  flex: { flex: 1, gap: spacing[2] },
  action: { alignSelf: 'flex-start' },
});
