import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Card, EmptyState, Icon, Screen, ScreenHeader, Skeleton, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { isFirebaseReady } from '@core/firebase';
import { formatOrderTime, listMyOrders } from '../services/orders';
import type { FoodStackParamList } from '../navigation/types';
import { isTerminalStatus, type Order, type OrderStatus } from '../types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/** How often the demo-mode list re-reads while open, so statuses move. */
const DEMO_REFRESH_MS = 4000;

/** The customer's words for each status — the kitchen's live on the supplier side. */
const STATUS_LABEL: Record<OrderStatus, { label: string; color: string; tint: string }> = {
  new: { label: 'Placed', color: colors.palette.amber800, tint: colors.palette.amber50 },
  accepted: { label: 'Accepted', color: colors.palette.blue500, tint: colors.palette.blue50 },
  preparing: { label: 'Preparing', color: colors.palette.purple700, tint: colors.palette.purple100 },
  ready_for_pickup: { label: 'Ready', color: colors.palette.orange600, tint: colors.palette.orange100 },
  picked_up: { label: 'On the way', color: colors.palette.blue600, tint: colors.palette.sky50 },
  delivered: { label: 'Delivered', color: colors.palette.green700, tint: colors.palette.green25 },
  cancelled: { label: 'Cancelled', color: colors.status.danger, tint: colors.palette.red100 },
  refunded: { label: 'Refunded', color: colors.textSecondary, tint: colors.surfaceAlt },
};

/**
 * My Orders — the customer's current and past orders (Profile → My orders).
 *
 * No Figma frame; built from the app's own parts: Checkout's white r16 cards
 * (414:3339), the Order History day-label eyebrow (346:3748) for the two
 * sections, and a status pill in the OrderCard style (335:5771). Tapping an
 * order opens Order Tracking.
 */
export function MyOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listMyOrders();
      setOrders(rows);
      setFailed(false);
    } catch {
      setFailed(true);
      setOrders((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      // Firebase reads cost money, so it reloads on focus and pull only; the
      // demo store is local and cheap to re-read.
      if (isFirebaseReady()) return;
      const timer = setInterval(() => void load(), DEMO_REFRESH_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  const [current, past, cancelled] = useMemo(() => {
    const rows = orders ?? [];
    return [rows.filter((o) => !isTerminalStatus(o.status)), rows.filter((o) => o.status === 'delivered'), rows.filter((o) => o.status === 'cancelled' || o.status === 'refunded')];
  }, [orders]);

  const open = (order: Order) => navigation.navigate('OrderTracking', { orderId: order.id });
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('FoodLanding'));

  return (
    <Screen>
      <ScreenHeader title="My orders" onBack={back} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {orders === null ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={92} borderRadius={radius['3xl']} />)
        ) : orders.length === 0 ? (
          <EmptyState
            icon="orderSummary"
            title={failed ? 'Something went wrong' : 'No orders yet'}
            message={
              failed
                ? 'Could not load your orders. Pull down to try again.'
                : 'When you order food, you can follow it live and find it again here.'
            }
            actionLabel={failed ? 'Try again' : 'Order food'}
            onAction={failed ? () => void load() : () => navigation.navigate('FoodLanding')}
          />
        ) : (
          <>
            {current.length ? <Section title="Current" orders={current} onOpen={open} /> : null}
            {past.length ? <Section title="Completed" orders={past} onOpen={open} /> : null}
            {cancelled.length ? <Section title="Cancelled" orders={cancelled} onOpen={open} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({ title, orders, onOpen }: { title: string; orders: Order[]; onOpen: (o: Order) => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="eyebrow" color={colors.textMuted}>
          {title.toUpperCase()}
        </Text>
        <View style={styles.hairline} />
        <Text variant="caption" color={colors.textMuted}>
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </Text>
      </View>
      {orders.map((o) => (
        <OrderRow key={o.id} order={o} onPress={() => onOpen(o)} />
      ))}
    </View>
  );
}

function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const tone = STATUS_LABEL[order.status];
  const items = order.items.map((it) => `${it.qty}× ${it.name}`).join(', ');
  return (
    <Card padded={false} onPress={onPress}>
      <View
        style={styles.row}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${order.merchantName}, ${tone.label}, ${formatMoney(order.pricing.total)}. Open order`}
      >
        <View style={styles.iconWell}>
          <Icon name="utensils" size={18} color={colors.primary} />
        </View>
        <View style={styles.middle}>
          <View style={styles.titleRow}>
            <Text variant="h5" color={colors.textStrong} numberOfLines={1} style={styles.shrink}>
              {order.merchantName}
            </Text>
            <View style={[styles.pill, { backgroundColor: tone.tint }]}>
              <Text variant="captionBold" color={tone.color} numberOfLines={1}>
                {tone.label}
              </Text>
            </View>
          </View>
          <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1}>
            {items}
          </Text>
          <View style={styles.metaRow}>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.shrink}>
              {formatOrderTime(order.createdAt)} · {order.ref}
            </Text>
            <Text variant="price" color={colors.textStrong}>
              {formatMoney(order.pricing.total)}
            </Text>
          </View>
        </View>
        <Icon name="chevronRight" size={16} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[1.5], paddingBottom: spacing[12], gap: spacing[6] },
  section: { gap: spacing[4] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[1.5] },
  hairline: { flex: 1, height: 0.5, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], padding: spacing[5] },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  middle: { flex: 1, minWidth: 0, gap: spacing[0.5] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  shrink: { flexShrink: 1, minWidth: 0 },
  pill: {
    flexShrink: 0,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
  },
});
