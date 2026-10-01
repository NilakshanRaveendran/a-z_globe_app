import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon, showToast, StarRow, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { formatClock, formatClockWindow } from '@core/utils/datetime';
import { OrderProgress } from './OrderProgress';
import { WriteReviewSheet } from './WriteReviewSheet';
import { useSubmitReview } from '../hooks/queries';
import { formatOrderTime, timeOf } from '../services/orders';
import { useActiveOrder } from '../store/activeOrder';
import { isTerminalStatus, type Order, type OrderStatus } from '../types';

/** The status line under the ETA, in the design's wording. One line (C36). */
const STATUS_COPY: Record<OrderStatus, string> = {
  new: 'Sending your order to the restaurant',
  accepted: "Restaurant's accepted your order",
  preparing: "Restaurant's preparing your order",
  ready_for_pickup: 'Your order is ready for pickup',
  picked_up: 'Your driver is on the way',
  delivered: 'Enjoy your meal!',
  cancelled: 'This order was cancelled',
  refunded: 'Your refund is on its way',
};

/** The explanatory line below the tracker. */
const STATUS_HINT: Record<OrderStatus, string> = {
  new: "We'll let you know as soon as the restaurant confirms.",
  accepted: "We'll let you know when your driver's on the way to the restaurant.",
  preparing: "We'll let you know when your driver's on the way to the restaurant.",
  ready_for_pickup: 'Your driver is collecting your order now.',
  picked_up: 'Your driver is on the way to you.',
  delivered: 'Thanks for ordering with A-Z Globe.',
  cancelled: "You haven't been charged for this order.",
  refunded: 'Your refund is on its way back to you.',
};

/** Takeaway wording — no driver; the customer collects from the restaurant. */
const PICKUP_COPY: Partial<Record<OrderStatus, string>> = {
  ready_for_pickup: 'Ready to collect',
  picked_up: 'Collected — enjoy!',
  delivered: 'Collected — enjoy!',
};
const PICKUP_HINT: Partial<Record<OrderStatus, string>> = {
  accepted: "We'll let you know when it's ready to collect.",
  preparing: "We'll let you know when it's ready to collect.",
  ready_for_pickup: 'Head to the restaurant and show your order ref at the counter.',
  picked_up: 'Thanks for ordering with A-Z Globe.',
};

type TrackedOrder = Pick<Order, 'etaFrom' | 'etaTo' | 'status' | 'merchantName' | 'ref'> &
  Partial<Pick<Order, 'timeline' | 'cancelReason' | 'deliveryMode' | 'scheduledFor' | 'orderType'>>;

/** Who called it off, when the timeline says. */
function cancelledBy(order: TrackedOrder): 'customer' | 'restaurant' | null {
  const entry = [...(order.timeline ?? [])].reverse().find((t) => t.status === 'cancelled');
  return entry?.by ?? null;
}

/** The big line at the top: the delivery window, or how the order ended. */
function headline(order: TrackedOrder): string {
  if (order.status === 'delivered') {
    const at = timeOf({ timeline: order.timeline ?? [] }, 'delivered');
    const done = order.orderType === 'pickup' ? 'Collected' : 'Delivered';
    return at ? `${done} ${formatClock(at)}` : done;
  }
  if (order.status === 'cancelled') return 'Order cancelled';
  if (order.status === 'refunded') return 'Order refunded';
  if (order.deliveryMode === 'scheduled' && order.scheduledFor) return formatOrderTime(order.scheduledFor);
  return formatClockWindow(order.etaFrom, order.etaTo);
}

function statusCopy(order: TrackedOrder): string {
  if (order.status === 'cancelled') {
    const by = cancelledBy(order);
    if (by === 'customer') return 'You cancelled this order';
    if (by === 'restaurant') return 'The restaurant cancelled this order';
  }
  if (order.orderType === 'pickup') return PICKUP_COPY[order.status] ?? STATUS_COPY[order.status];
  return STATUS_COPY[order.status];
}

function statusHint(order: TrackedOrder): string {
  if (order.status === 'cancelled' && order.cancelReason) {
    return `Reason: ${order.cancelReason}. ${STATUS_HINT.cancelled}`;
  }
  if (order.orderType === 'pickup') return PICKUP_HINT[order.status] ?? STATUS_HINT[order.status];
  return STATUS_HINT[order.status];
}

/**
 * Live order card — Figma 3:943 (full) and 324:2157 (compact, Home).
 *
 *   ETA      "8:15 – 8:30 PM" Urbanist 700 22/27.5 #0F172A
 *   status   green dot + "On time" 600 12/18 #22C55E · grey status copy, one line
 *   art      64pt #E8F4FD circle with the scooter illustration
 *   tracker  three nodes (Status Loader 91:3780)
 *   hint     12/18 #6B7280
 *   info     merchant 600 15/22.5 + "Food Delivery · Ref AZG-7821" 500 12/18
 *   actions  "Call" pill #E5E7EB · "Track Order" pill #00B14F
 *
 * A finished order says how it ended instead of an ETA and never shows
 * "On time"/"Running late"; a cancelled or refunded one draws the tracker in
 * brand red, stopped where it was (C9). The compact card is pressable
 * (`onPress`) and opens Order Tracking (C2).
 */
export function TrackOrderCard({
  order,
  merchantPhone,
  onTrack,
  onPress,
  compact = false,
  footer,
}: {
  order: TrackedOrder;
  merchantPhone?: string;
  /** Shows the green "Track Order" button (full card only). */
  onTrack?: () => void;
  /** Makes the whole card a button — the compact Home card. */
  onPress?: () => void;
  compact?: boolean;
  /** Extra content at the bottom of the card, e.g. the review prompt. */
  footer?: ReactNode;
}) {
  const terminal = isTerminalStatus(order.status);
  const scheduled = order.deliveryMode === 'scheduled' && !!order.scheduledFor;
  const late = !terminal && !scheduled && order.etaTo > 0 && Date.now() > order.etaTo;
  const danger = order.status === 'cancelled' || order.status === 'refunded';
  const canCall = !!merchantPhone && !terminal;

  // The pressable part stops above the footer: the footer's own buttons (and
  // the review sheet it opens, which React bubbles presses out of on web) must
  // never also open tracking.
  const body = (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text
            variant="h1"
            color={danger ? colors.primary : colors.palette.slate900}
            style={styles.eta}
            numberOfLines={1}
          >
            {headline(order)}
          </Text>
          <View style={styles.statusRow}>
            {!terminal ? (
              <>
                <View style={[styles.dot, late && styles.dotLate]} />
                <Text variant="label" color={late ? colors.primary : colors.success}>
                  {scheduled ? 'Scheduled' : late ? 'Running late' : 'On time'}
                </Text>
                <Text variant="bodySm" color={colors.borderStrong}>
                  ·
                </Text>
              </>
            ) : null}
            <Text variant="bodySm" color={colors.textSecondary} style={styles.flex} numberOfLines={1}>
              {statusCopy(order)}
            </Text>
          </View>
        </View>

        <View style={[styles.art, compact && styles.foodArt]}>
          {compact ? (
            <Image
              source={require('../../../../assets/images/services/order-food.png')}
              style={styles.foodImage}
              contentFit="contain"
            />
          ) : (
            <Icon name={order.orderType === 'pickup' ? 'store' : 'bike'} size={32} color={colors.success} />
          )}
        </View>
      </View>

      <OrderProgress status={order.status} timeline={order.timeline} orderType={order.orderType} />

      <Text variant="bodySm" color={colors.textSecondary} style={styles.hint}>
        {statusHint(order)}
      </Text>

      {!compact ? (
        <>
          <View style={styles.divider} />

          <View style={styles.info}>
            <Text variant="h4" color={colors.palette.slate900} numberOfLines={1}>
              {order.merchantName}
            </Text>
            <Text variant="bodySm" color={colors.textSecondary}>
              {order.orderType === 'pickup' ? 'Takeaway' : 'Food Delivery'} · Ref {order.ref}
            </Text>
          </View>

          {canCall || onTrack ? (
            <View style={styles.actions}>
              {canCall ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${order.merchantName}`}
                  onPress={() => void Linking.openURL(`tel:${merchantPhone!.replace(/\s/g, '')}`)}
                  style={({ pressed }) => [styles.callButton, !onTrack && styles.callWide, pressed && styles.pressed]}
                >
                  <Icon name="phone" size={16} color={colors.text} />
                  <Text variant="bodyLg" color={colors.text}>
                    {onTrack ? 'Call' : 'Call restaurant'}
                  </Text>
                </Pressable>
              ) : null}

              {onTrack ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onTrack}
                  style={({ pressed }) => [styles.trackButton, pressed && styles.pressed]}
                >
                  <Text variant="bodyLg" color={colors.onPrimary}>
                    Track Order
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${order.merchantName} order, ${statusCopy(order)}. Open tracking`}
            onPress={onPress}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {body}
          </Pressable>
        ) : (
          body
        )}
        {footer ?? null}
      </View>
    </View>
  );
}

/**
 * "How was your order?" — shown once an order is delivered, on the Home card
 * and on Order Tracking, until the customer reviews it or waves it away (C9).
 * Opens the Write-a-Review sheet (426:3202); the review is tied to this order,
 * which is what `firestore.rules` checks before accepting it.
 */
export function ReviewPrompt({
  order,
  divided = true,
}: {
  order: Pick<Order, 'id' | 'merchantId' | 'merchantName' | 'items'>;
  /** Draw the hairline above it — inside a card, under other content. */
  divided?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const submit = useSubmitReview();
  const markReviewPrompted = useActiveOrder((s) => s.markReviewPrompted);

  const onSubmit = async (rating: number, text: string) => {
    try {
      await submit.mutateAsync({
        merchantId: order.merchantId,
        rating,
        text,
        orderId: order.id,
        ...(order.items?.[0]?.name ? { dishTag: order.items[0].name } : {}),
      });
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : "Couldn't post your review. Try again.", {
        tone: 'error',
      });
      throw error;
    }
    showToast('Thanks for your review!');
    markReviewPrompted(order.id);
  };

  return (
    <>
      {divided ? <View style={styles.divider} /> : null}
      <View style={styles.prompt}>
        <View style={styles.promptText}>
          <Text variant="h5" color={colors.textStrong}>
            How was your order?
          </Text>
          <Text variant="bodySm" color={colors.textSecondary} numberOfLines={2}>
            Rate {order.merchantName} and help others choose.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rate ${order.merchantName}`}
          onPress={() => setOpen(true)}
          hitSlop={6}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <StarRow rating={0} size={18} gap={spacing[1]} />
        </Pressable>
      </View>
      <View style={styles.promptActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => markReviewPrompted(order.id)}
          style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}
        >
          <Text variant="bodyLg" color={colors.text}>
            Not now
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.reviewButton, pressed && styles.pressed]}
        >
          <Text variant="bodyLg" color={colors.onPrimary}>
            Write a Review
          </Text>
        </Pressable>
      </View>

      <WriteReviewSheet
        visible={open}
        merchantName={order.merchantName}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  prompt: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  promptText: { flex: 1, minWidth: 0, gap: spacing[1] },
  promptActions: { flexDirection: 'row', gap: spacing[3.5] },
  notNow: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: spacing[6],
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  reviewButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  wrap: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[8] },
  section: { gap: spacing[6] },
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
  flex: { flex: 1, minWidth: 0 },
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
  foodArt: { backgroundColor: colors.success },
  foodImage: { width: 40, height: 40 },
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
  callWide: { flex: 1, justifyContent: 'center' },
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
