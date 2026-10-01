import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, type IconName } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { deliveryWindow, pickupWindow } from '../services/orders';
import { formatKm, type DeliveryQuote } from '../services/deliveryPricing';
import type { Fulfilment } from '../store/cart';
import type { Merchant } from '../types';

/**
 * Whether a restaurant delivers. Older and seeded restaurants charge a fee
 * without listing the feature, so a fee also counts.
 */
export function deliversFrom(merchant: Pick<Merchant, 'features' | 'deliveryFee'> | null | undefined): boolean {
  if (!merchant) return true;
  return (merchant.features ?? []).includes('homeDelivery') || merchant.deliveryFee > 0;
}

/**
 * The choice that actually applies — takeaway when the restaurant doesn't
 * deliver, or doesn't deliver as far as this address.
 */
export function effectiveFulfilment(
  chosen: Fulfilment,
  merchant: Pick<Merchant, 'features' | 'deliveryFee'> | null | undefined,
  quote?: DeliveryQuote | null
): Fulfilment {
  if (chosen !== 'delivery') return chosen;
  if (!deliversFrom(merchant)) return 'pickup';
  return quote && !quote.ok && quote.reason === 'outOfRange' ? 'pickup' : chosen;
}

/** The Delivery card's price line for a quote. */
function deliveryMeta(quote: DeliveryQuote | null | undefined, delivers: boolean): string {
  if (!delivers) return 'Not offered';
  if (!quote) return '';
  if (!quote.ok) {
    if (quote.reason === 'outOfRange') return `Outside ${formatKm(quote.maxKm ?? 0)} km area`;
    return 'Priced by distance';
  }
  return quote.fee === 0 ? 'Free delivery' : `${formatMoney(quote.fee)} fee`;
}

/**
 * "How would you like it?" — Delivery or Takeaway, as two selectable cards in
 * the cart and at checkout. Each shows its time and what it costs; the chosen
 * one gets the brand-red border, tint and a tick, like the delivery-time tiles.
 */
export function FulfilmentToggle({
  merchant,
  quote,
  value,
  onChange,
  compact = false,
}: {
  merchant: Merchant | null | undefined;
  /** What delivery to the chosen address costs — services/deliveryPricing. */
  quote: DeliveryQuote | null | undefined;
  value: Fulfilment;
  onChange: (next: Fulfilment) => void;
  /**
   * A two-part switch for one restaurant's section of a cart that holds
   * several: icon, "Delivery" / "Takeaway" and the price · time underneath.
   */
  compact?: boolean;
}) {
  const delivers = deliversFrom(merchant);
  const reachable = delivers && !(quote && !quote.ok && quote.reason === 'outOfRange');
  const delivery = merchant ? deliveryWindow(merchant, 'standard') : null;
  const pickup = merchant ? pickupWindow(merchant) : null;
  const current = effectiveFulfilment(value, merchant, quote);
  const km = quote?.distanceKm;

  if (compact) {
    return (
      <View style={styles.switch} accessibilityRole="radiogroup">
        <CompactOption
          icon="bike"
          title="Delivery"
          meta={
            delivers && quote && !quote.ok && quote.reason === 'outOfRange'
              ? deliveryMeta(quote, delivers)
              : [deliveryMeta(quote, delivers), delivery && delivers ? `${delivery.min}–${delivery.max} min` : '']
                  .filter(Boolean)
                  .join(' · ')
          }
          selected={current === 'delivery'}
          disabled={!reachable}
          onPress={() => onChange('delivery')}
        />
        <CompactOption
          icon="store"
          title="Takeaway"
          meta={pickup ? `Free · ${pickup.min}–${pickup.max} min` : 'Free'}
          selected={current === 'pickup'}
          onPress={() => onChange('pickup')}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text variant="h4" color={colors.textHeading}>
        How would you like it?
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        <Option
          icon="bike"
          title="Delivery"
          detail={
            delivery
              ? `${delivery.min}–${delivery.max} min${km != null ? ` · ${formatKm(km)} km` : ''}`
              : ''
          }
          meta={deliveryMeta(quote, delivers)}
          selected={current === 'delivery'}
          disabled={!reachable}
          onPress={() => onChange('delivery')}
        />
        <Option
          icon="store"
          title="Takeaway"
          detail={pickup ? `Ready in ${pickup.min}–${pickup.max} min` : ''}
          meta="No delivery fee"
          selected={current === 'pickup'}
          onPress={() => onChange('pickup')}
        />
      </View>
    </View>
  );
}

function CompactOption({
  icon,
  title,
  meta,
  selected,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  meta: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${title}, ${meta}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.half,
        selected && styles.optionOn,
        disabled && styles.optionOff,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={18} color={selected ? colors.primary : colors.textSecondary} />
      <View style={styles.halfText}>
        <Text variant="label" color={selected ? colors.primary : colors.textStrong}>
          {title}
        </Text>
        <Text variant="micro" color={selected ? colors.primary : colors.textMuted} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

function Option({
  icon,
  title,
  detail,
  meta,
  selected,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  meta: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${title}, ${detail}, ${meta}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionOn,
        disabled && styles.optionOff,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.optionHead}>
        <View style={[styles.iconWell, selected && styles.iconWellOn]}>
          <Icon name={icon} size={18} color={selected ? colors.onPrimary : colors.textSecondary} />
        </View>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected ? <Icon name="check" size={12} color={colors.onPrimary} /> : null}
        </View>
      </View>
      <Text variant="h5" color={selected ? colors.primary : colors.textStrong}>
        {title}
      </Text>
      <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1}>
        {detail}
      </Text>
      <Text variant="labelSm" color={selected ? colors.primary : colors.textMuted} numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[4] },
  row: { flexDirection: 'row', gap: spacing[4] },
  option: {
    flex: 1,
    minWidth: 0,
    gap: spacing[0.5],
    padding: spacing[5],
    borderRadius: radius['3xl'],
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionOff: { opacity: 0.5 },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  iconWellOn: { backgroundColor: colors.primary },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  pressed: { opacity: 0.85 },
  switch: { flexDirection: 'row', gap: spacing[3] },
  half: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  halfText: { flex: 1, minWidth: 0 },
});
