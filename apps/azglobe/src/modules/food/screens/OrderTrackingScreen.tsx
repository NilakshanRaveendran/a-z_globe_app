import { useEffect, useState, type ReactNode } from 'react';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, EmptyState, Icon, Screen, ScreenHeader, showToast, Skeleton, Text, type IconName } from '@core/ui';
import { Alert } from '@core/ui/alert';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { formatClockWindow } from '@core/utils/datetime';
import { ReviewPrompt, TrackOrderCard } from '../components/TrackOrderCard';
import { useMerchant } from '../hooks/queries';
import { addressSubtitle, addressTitle } from '../services/addresses';
import {
  canCustomerCancel,
  cancelOrder,
  formatOrderTime,
  getOrder,
  watchOrder,
} from '../services/orders';
import { useReviewPrompted } from '../store/activeOrder';
import type { FoodStackParamList } from '../navigation/types';
import type { DeliveryMode, Order } from '../types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

const DROPOFF_LABEL: Record<string, string> = {
  door: 'Meet at my door',
  lobby: 'Leave at lobby',
  gate: 'Leave at gate',
};

const MODE_LABEL: Record<DeliveryMode, string> = {
  priority: 'Priority ⚡',
  standard: 'Standard delivery',
  scheduled: 'Scheduled',
};

/**
 * Order Tracking — one order, live (C2).
 *
 *   card      the full TrackOrderCard (Figma 3:943): ETA, status, the Status
 *             Loader (91:3780), the restaurant and ref, "Call restaurant"
 *   review    "How was your order?" once delivered, until answered
 *   details   Checkout's (414:3339) grouped-row card: address + drop-off,
 *             delivery mode / scheduled time, payment method, note, utensils
 *   summary   the items with their options, then Checkout's price details
 *             (Subtotal · Promo · Delivery fee · Priority fee · Total in red)
 *   cancel    an outlined red "Cancel order" while the restaurant has not
 *             accepted it yet, behind a confirmation
 *
 * The order is watched while the screen is focused (a realtime listener on
 * Firebase, a short poll in demo mode), so every step the restaurant takes
 * shows up here without a refresh.
 */
export function OrderTrackingScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'OrderTracking'>>();
  const isFocused = useIsFocused();
  // undefined while loading; null when there is no such order.
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);
  const { data: merchant } = useMerchant(order?.merchantId ?? '');
  const prompted = useReviewPrompted(order?.id);

  useEffect(() => {
    setOrder((prev) => (prev && prev.id === params.orderId ? prev : undefined));
    if (!isFocused) return;
    return watchOrder(params.orderId, (next) => setOrder(next));
  }, [params.orderId, isFocused]);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('FoodLanding'));

  const cancel = async (current: Order) => {
    setCancelling(true);
    try {
      await cancelOrder(current);
    } catch (error) {
      Alert.alert(
        "Couldn't cancel the order",
        error instanceof Error && error.message ? error.message : 'Check your connection and try again.'
      );
      setOrder(await getOrder(current.id).catch(() => current));
      setCancelling(false);
      return;
    }
    showToast('Order cancelled');
    // The live watch will catch up too; a failed re-read here is not a failed cancel.
    setOrder(await getOrder(current.id).catch(() => ({ ...current, status: 'cancelled' as const })));
    setCancelling(false);
  };

  const confirmCancel = (current: Order) =>
    Alert.alert(
      'Cancel this order?',
      `${current.merchantName} hasn't accepted it yet, so you won't be charged.`,
      [
        { text: 'Keep order', style: 'cancel' },
        { text: 'Cancel order', style: 'destructive', onPress: () => void cancel(current) },
      ]
    );

  return (
    <Screen>
      <ScreenHeader
        title="Track order"
        subtitle={order ? `Ref ${order.ref}` : undefined}
        onBack={back}
       
      />

      {order === undefined ? (
        <View style={styles.sections}>
          <Skeleton height={300} borderRadius={radius['3xl']} />
          <Skeleton height={180} borderRadius={radius['3xl']} />
        </View>
      ) : order === null ? (
        <EmptyState
          variant="page"
          icon="orderSummary"
          title="Order not found"
          message="It may have been placed on another device. Your recent orders are in My orders."
          actionLabel="My orders"
          onAction={() => navigation.navigate('MyOrders')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.cardWrap}>
            <TrackOrderCard
              order={order}
              merchantPhone={merchant?.phone}
              footer={order.status === 'delivered' && !prompted ? <ReviewPrompt order={order} /> : null}
            />
          </View>

          <View style={styles.sections}>
            <DeliveryDetails order={order} pickupAddress={merchant?.address} />
            <OrderSummary order={order} />

            <Text variant="bodySm" color={colors.textMuted} align="center">
              Placed {formatOrderTime(order.createdAt)} · Ref {order.ref}
            </Text>

            {canCustomerCancel(order) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: cancelling, busy: cancelling }}
                disabled={cancelling}
                onPress={() => confirmCancel(order)}
                style={({ pressed }) => [styles.cancel, (pressed || cancelling) && styles.pressed]}
              >
                {cancelling ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text variant="h5" color={colors.primary}>
                    Cancel order
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

/** A grouped row: icon well, a muted caption, the value, and optional detail. */
function DetailRow({
  icon,
  tint = false,
  caption,
  value,
  detail,
  leading,
}: {
  icon?: IconName;
  tint?: boolean;
  caption: string;
  value: string;
  detail?: string;
  leading?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      {leading ?? (
        <View style={tint ? styles.iconWell : styles.iconWellNeutral}>
          <Icon name={icon ?? 'orderSummary'} size={16} color={tint ? colors.primary : colors.textSecondary} />
        </View>
      )}
      <View style={styles.flex}>
        <Text variant="bodySm" color={colors.textMuted}>
          {caption}
        </Text>
        <Text variant="h5" color={colors.textStrong}>
          {value}
        </Text>
        {detail ? (
          <Text variant="bodySm" color={colors.textSecondary}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DeliveryDetails({ order, pickupAddress }: { order: Order; pickupAddress?: string }) {
  const a = order.address;
  const pickup = order.orderType === 'pickup';
  const extra = a ? [a.apt, a.buildingName, a.landmark].filter(Boolean).join(' · ') : '';
  const isCash = /cash/i.test(order.paymentMethod);
  const when =
    order.deliveryMode === 'scheduled' && order.scheduledFor
      ? `For ${formatOrderTime(order.scheduledFor)}`
      : `${pickup ? 'Ready' : 'Estimated'} ${formatClockWindow(order.etaFrom, order.etaTo)}`;

  return (
    <Card padded={false}>
      {pickup ? (
        <DetailRow
          icon="store"
          tint
          caption="Pick up from"
          value={order.merchantName}
          detail={pickupAddress || undefined}
        />
      ) : (
        <DetailRow
          icon="mapPin"
          tint
          caption="Deliver to"
          value={a ? addressTitle(a) : 'No address on this order'}
          detail={
            a
              ? [addressSubtitle(a), extra, DROPOFF_LABEL[order.dropoffOption] ?? DROPOFF_LABEL.door]
                  .filter(Boolean)
                  .join('\n')
              : undefined
          }
        />
      )}
      <View style={styles.divider} />
      <DetailRow
        icon="clock"
        caption={pickup ? 'Takeaway' : 'Delivery'}
        value={
          pickup
            ? order.deliveryMode === 'scheduled'
              ? 'Scheduled pickup'
              : 'Pickup ASAP'
            : MODE_LABEL[order.deliveryMode] ?? 'Standard delivery'
        }
        detail={when}
      />
      <View style={styles.divider} />
      <DetailRow
        caption="Payment method"
        value={order.paymentMethod || 'Cash on delivery'}
        leading={
          <View style={isCash ? styles.cod : styles.visa}>
            {isCash ? (
              <Icon name="cash" size={20} color={colors.palette.green600} />
            ) : (
              <Text variant="labelSm" color={colors.onPrimary}>
                VISA
              </Text>
            )}
          </View>
        }
      />
      {order.noteToRestaurant ? (
        <>
          <View style={styles.divider} />
          <DetailRow icon="pencil" caption="Note to restaurant" value={order.noteToRestaurant} />
        </>
      ) : null}
      {order.requestUtensils ? (
        <>
          <View style={styles.divider} />
          <DetailRow icon="utensils" caption="Extras" value="Utensils requested" />
        </>
      ) : null}
    </Card>
  );
}

function OrderSummary({ order }: { order: Order }) {
  const count = order.items.reduce((sum, it) => sum + it.qty, 0);
  const p = order.pricing;
  return (
    <Card style={styles.block}>
      <View style={styles.blockHead}>
        <View style={styles.iconWellNeutral}>
          <Icon name="orderSummary" size={16} color={colors.textSecondary} />
        </View>
        <View style={styles.flex}>
          <Text variant="h4" color={colors.textStrong}>
            Order summary
          </Text>
          <Text variant="bodySm" color={colors.textSecondary}>
            {count} item{count === 1 ? '' : 's'} · {order.merchantName}
          </Text>
        </View>
      </View>

      <View style={styles.items}>
        {order.items.map((it, i) => (
          <View key={`${it.menuItemId}-${i}`} style={styles.itemRow}>
            <View style={styles.flex}>
              <Text variant="bodyLg" color={colors.textStrong}>
                ×{it.qty}  {it.name}
              </Text>
              {it.selectedOptions?.length ? (
                <Text variant="bodySm" color={colors.textSecondary}>
                  {it.selectedOptions.map((o) => o.label).join(' · ')}
                </Text>
              ) : null}
            </View>
            <Text variant="bodyLg" color={colors.textStrong}>
              {formatMoney(it.lineTotal)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.dividerFlush} />
      <PriceRow label="Subtotal" value={formatMoney(p.subtotal)} />
      {p.promoDiscount > 0 ? (
        <PriceRow
          // A typed code is its own id ("MAMA20"); an automatic offer's id is not.
          label={order.promoCode && /^[A-Z0-9]+$/.test(order.promoCode) ? `Promo (${order.promoCode})` : 'Offer'}
          value={`-${formatMoney(p.promoDiscount)}`}
          accent
        />
      ) : null}
      {order.orderType === 'pickup' ? (
        <PriceRow label="Takeaway" value="No delivery fee" />
      ) : (
        <PriceRow label="Delivery fee" value={p.deliveryFee > 0 ? formatMoney(p.deliveryFee) : 'Free'} />
      )}
      {p.priorityFee > 0 ? <PriceRow label="Priority fee" value={formatMoney(p.priorityFee)} /> : null}
      <View style={styles.dividerFlush} />
      <View style={styles.priceRow}>
        <Text variant="h3" color={colors.textHeading}>
          Total
        </Text>
        <Text variant="h3" color={colors.primary}>
          {formatMoney(p.total)}
        </Text>
      </View>
    </Card>
  );
}

function PriceRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text variant="bodyLg" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodyLg" color={accent ? colors.success : colors.textStrong}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[12] },
  // TrackOrderCard brings its own 16pt gutter and 20pt top.
  cardWrap: { marginTop: -spacing[8] + spacing[1.5] },
  sections: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[4], gap: spacing[4] },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4], padding: spacing[5] },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing[5] },
  dividerFlush: { height: 1, backgroundColor: colors.border },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  iconWellNeutral: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  // Same 36pt well as the other rows, so every value lines up.
  visa: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1F71',
  },
  cod: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successTint,
  },
  block: { gap: spacing[3] },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  items: { gap: spacing[3], paddingTop: spacing[1.5] },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4] },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: {
    height: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
});
