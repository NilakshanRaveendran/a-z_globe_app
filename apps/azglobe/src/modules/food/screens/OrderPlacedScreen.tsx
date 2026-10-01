import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Screen, Text } from '@core/ui';
import { colors, fontFamily, radius, spacing } from '@core/theme';
import { formatOrderTime, getOrder } from '../services/orders';
import type { FoodStackParamList } from '../navigation/types';
import type { Order } from '../types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * Order Placed — Figma 416:4243.
 *
 *   page    pad 60/32, content centred
 *   tick    100pt #FFF1F1 circle, 24 below · 52pt line check, #D42B2B 2.5 ring
 *           and 2.8 tick
 *   title   "Order Placed!" Urbanist 700 24/36 #1F2937 + 24pt red
 *           celebrate-line icon, 6 apart
 *   body    "Your order is being prepared at <merchant>." 400 14/21 #6B7280, 8 below
 *   eta     "Estimated delivery: 25–40 min" 600 13/19.5 #D42B2B, 36 below
 *   button  "Back to Menu" r14 · pad 14/32 · 700 15/22.5 white on #D42B2B
 *
 * Beyond the frame (C23): the order reference, so the customer can quote it,
 * and "Track order" beside "Back to Menu", which opens live tracking.
 */
export function OrderPlacedScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'OrderPlaced'>>();
  const [orders, setOrders] = useState<Order[]>([]);
  // One checkout can place an order at several restaurants.
  const ids = params.orderIds?.length ? params.orderIds : [params.orderId];
  const many = ids.length > 1;
  const order = orders[0] ?? null;

  useEffect(() => {
    let active = true;
    Promise.all(ids.map((id) => getOrder(id).catch(() => null)))
      .then((all) => {
        if (active) setOrders(all.filter((o): o is Order => !!o));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // The ids are fixed for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orderId]);

  const track = (orderId: string) =>
    navigation.reset({
      index: 1,
      routes: [{ name: 'FoodLanding' }, { name: 'OrderTracking', params: { orderId } }],
    });

  // Measure the window from when the order was placed, falling back to now if
  // the timestamp is missing, and only render it when the result is sane.
  const scheduled = order?.deliveryMode === 'scheduled' && order.scheduledFor ? order.scheduledFor : null;
  const etaMinutes = (() => {
    if (!order || scheduled) return null;
    const from = order.createdAt || Date.now();
    const lo = Math.round((order.etaFrom - from) / 60_000);
    const hi = Math.round((order.etaTo - from) / 60_000);
    const plausible = Number.isFinite(lo) && Number.isFinite(hi) && lo >= 0 && hi <= 240;
    return plausible ? `${lo}–${hi} min` : null;
  })();

  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.tickWell}>
          <Icon name="checkCircle" size={52} color={colors.primary} />
        </View>

        <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={many ? 'Orders Placed!' : 'Order Placed!'}>
          <Text variant="display" color={colors.text} align="center">
            {many ? 'Orders Placed!' : 'Order Placed!'}
          </Text>
          <Icon name="celebrate" size={24} color={colors.primary} />
        </View>

        {many ? (
          <>
            <Text variant="bodyLg" color={colors.textSecondary} align="center" style={styles.lead}>
              {ids.length} orders, paid together. Each restaurant prepares its own and delivers it or has it ready
              to collect.
            </Text>
            <View style={styles.orderList}>
              {orders.map((o) => (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Track ${o.merchantName} order`}
                  onPress={() => track(o.id)}
                  style={({ pressed }) => [styles.orderRow, pressed && styles.pressed]}
                >
                  <Icon name={o.orderType === 'pickup' ? 'store' : 'bike'} size={18} color={colors.primary} />
                  <View style={styles.flex}>
                    <Text variant="labelMd" color={colors.text} numberOfLines={1}>
                      {o.merchantName}
                    </Text>
                    <Text variant="bodySm" color={colors.textSecondary}>
                      {o.orderType === 'pickup' ? 'Takeaway' : 'Delivery'} · Ref {o.ref}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
        <Text variant="bodyLg" color={colors.textSecondary} align="center" style={styles.lead}>
          {scheduled
            ? `${order?.merchantName ?? 'The restaurant'} has your order and will have it with you on time.`
            : order?.orderType === 'pickup'
              ? `${order.merchantName} is preparing your takeaway. We'll tell you when it's ready to collect.`
              : `Your order is being prepared at ${order?.merchantName ?? 'the restaurant'}.`}
        </Text>
        )}

        {many ? null : scheduled ? (
          <Text variant="labelMd" color={colors.primary} align="center">
            Scheduled for {formatOrderTime(scheduled)}
          </Text>
        ) : etaMinutes ? (
          <Text variant="labelMd" color={colors.primary} align="center">
            {order?.orderType === 'pickup' ? 'Ready for pickup' : 'Estimated delivery'}: {etaMinutes}
          </Text>
        ) : null}

        {!many && order?.ref ? (
          <Text variant="bodySm" color={colors.textMuted} align="center" style={styles.ref}>
            Order ref {order.ref}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Back to Menu"
            // Reset rather than navigate: the order is placed, so Checkout and the
            // now-empty Cart must not remain in the back stack behind this screen.
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'FoodLanding' }] })}
            fullWidth={false}
            style={styles.cta}
          />
          <Button
            label={many ? 'Track orders' : 'Track order'}
            variant="secondary"
            // Tracking sits on top of Order Food, so back from it lands there —
            // never on the emptied cart. Several orders open My Orders.
            onPress={() =>
              many
                ? navigation.reset({ index: 1, routes: [{ name: 'FoodLanding' }, { name: 'MyOrders' }] })
                : track(params.orderId)
            }
            fullWidth={false}
            style={styles.cta}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
  },
  tickWell: {
    width: 100,
    height: 100,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    marginBottom: spacing[9],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  orderList: { alignSelf: 'stretch', gap: spacing[3], marginTop: spacing[6] },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  lead: { fontFamily: fontFamily[400], paddingBottom: spacing[3] },
  ref: { paddingTop: spacing[1.5] },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[3],
    // 36 on the frame, below the ETA; the ref line takes 4 of it.
    marginTop: spacing[12],
  },
  cta: { paddingHorizontal: spacing[12] },
});
