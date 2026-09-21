import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { OrderProgress } from './OrderProgress';
import type { Order, OrderStatus } from '../types';
import { formatClockWindow } from '@core/utils/datetime';

/** The status line under the ETA, in the design's wording. */
const STATUS_COPY: Record<OrderStatus, string> = {
  new: 'Sending your order to the restaurant',
  accepted: "Restaurant's accepted your order",
  preparing: "Restaurant's preparing your order",
  ready_for_pickup: 'Your order is ready for pickup',
  picked_up: 'Your driver is on the way',
  delivered: 'Delivered — enjoy your meal',
  cancelled: 'This order was cancelled',
  refunded: 'This order was refunded',
};

/** The explanatory line below the tracker. */
const STATUS_HINT: Record<OrderStatus, string> = {
  new: "We'll let you know as soon as the restaurant confirms.",
  accepted: "We'll let you know when your driver's on the way to the restaurant.",
  preparing: "We'll let you know when your driver's on the way to the restaurant.",
  ready_for_pickup: 'Your driver is collecting your order now.',
  picked_up: 'Your driver is on the way to you.',
  delivered: 'Thanks for ordering with A-Z Globe.',
  cancelled: 'No charge was taken for this order.',
  refunded: 'Your refund is on its way back to you.',
};

/**
 * Live order card at the top of Home — Figma 3:943 and 324:2157.
 *
 *   ETA      "8:15 – 8:30 PM" Urbanist 700 22/27.5 #0F172A
 *   status   green dot + "On time" 600 12/18 #22C55E · grey status copy
 *   art      64pt #E8F4FD circle with the scooter illustration
 *   tracker  three nodes
 *   hint     12/18 #6B7280
 *   info     merchant 600 15/22.5 + "Food Delivery · Ref AZG-7821" 500 12/18
 *   actions  "Call" pill #E5E7EB · "Track Order" pill #00B14F
 */
export function TrackOrderCard({
  order,
  merchantPhone,
  onTrack,
}: {
  order: Order;
  merchantPhone?: string;
  onTrack: () => void;
}) {
  const late = Date.now() > order.etaTo;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <Text variant="h1" color={colors.palette.slate900} style={styles.eta}>
              {formatClockWindow(order.etaFrom, order.etaTo)}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, late && styles.dotLate]} />
              <Text variant="label" color={late ? colors.primary : colors.success}>
                {late ? 'Running late' : 'On time'}
              </Text>
              <Text variant="bodySm" color={colors.borderStrong}>
                ·
              </Text>
              <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1} style={styles.flex}>
                {STATUS_COPY[order.status]}
              </Text>
            </View>
          </View>

          <View style={styles.art}>
            <Text style={styles.artGlyph}>🛵</Text>
          </View>
        </View>

        <OrderProgress status={order.status} />

        <Text variant="bodySm" color={colors.textSecondary} style={styles.hint}>
          {STATUS_HINT[order.status]}
        </Text>

        <View style={styles.divider} />

        <View style={styles.info}>
          <Text variant="h4" color={colors.palette.slate900}>
            {order.merchantName}
          </Text>
          <Text variant="bodySm" color={colors.textSecondary}>
            Food Delivery · Ref {order.ref}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${order.merchantName}`}
            disabled={!merchantPhone}
            onPress={() => merchantPhone && Linking.openURL(`tel:${merchantPhone.replace(/\s/g, '')}`)}
            style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
          >
            <Icon name="phone" size={16} color={colors.text} />
            <Text variant="bodyLg" color={colors.text}>
              Call
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onTrack}
            style={({ pressed }) => [styles.trackButton, pressed && styles.pressed]}
          >
            <Text variant="bodyLg" color={colors.onPrimary}>
              Track Order
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[4] },
  card: {
    gap: spacing[6],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[7],
    borderRadius: radius['3xl'],
    borderWidth: 0.54,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[4] },
  flex: { flex: 1 },
  eta: { fontSize: 22, lineHeight: 27.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5], paddingTop: spacing[1.5] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  dotLate: { backgroundColor: colors.primary },
  art: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FD',
  },
  artGlyph: { fontSize: 32, lineHeight: 40 },
  hint: { lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.surfaceAlt },
  info: { gap: spacing[2.5] },
  actions: { flexDirection: 'row', gap: spacing[3.5] },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  trackButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: radius.pill,
    // Figma uses this green for the track CTA rather than the success token.
    backgroundColor: '#00B14F',
  },
  pressed: { opacity: 0.85 },
});
