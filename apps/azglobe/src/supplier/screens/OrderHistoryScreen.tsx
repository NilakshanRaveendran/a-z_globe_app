import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, fontFamily, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, Text } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import {
  addDays,
  formatClock,
  formatClockWindow,
  formatDate,
  formatDayLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '@core/utils/datetime';
import type { Order, OrderStatus } from '@modules/food/types';
import { OrderProgress } from '@modules/food/components/OrderProgress';
import type { RootStackParamList } from '@app/navigation/types';
import { listOrderHistory } from '../services/orders';
import { SupplierHeader } from '../components/SupplierHeader';
import { DateFilterSheet } from '../components/DateFilterSheet';

/**
 * Order History — Figma 346:2826 (collapsed) and 346:3748 (a card expanded).
 *
 *   chips    pad 12/16 · 1px #F3F4F6 rule below · pills pad 6/14 ·
 *            on #D42B2B 700 13/19.5 white · off #F3F4F6 500 13/19.5 #374151 ·
 *            1×22 #E5E7EB divider · "Date" pill pad 6/10 with a 14pt calendar
 *   summary  pad 10/16 · "10" 700 13 #1F2937 "orders" 500 12 #6B7280 ·
 *            6pt dots #16A34A delivered / #D42B2B cancelled
 *   day      "TODAY" eyebrow #9CA3AF · hairline #E5E7EB · "3 orders" 500 10/15
 *   card     r16 · 1px #F3F4F6 · shadow 0 1 4 8% · head pad 14/16 gap 12 ·
 *            40pt avatar · name 700 14/21 #111827 · status pill pad 2/8
 *            600 10/15 · "#1042" 600 11 #D42B2B · "·" #E5E7EB · time 400 11 #9CA3AF
 *   expanded tracker (green delivered, red cancelled) · ITEMS ORDERED ·
 *            ×n chip #F3F4F6 r6 600 11 #374151 · name 400 13 · price 600 12 ·
 *            Total 700 12 #6B7280 / 700 13 #D42B2B · note banner #FFFBEB/#FDE68A ·
 *            "Est. delivery" row · outcome banner (green / red)
 *
 * Shows only finished orders — delivered, cancelled, refunded. Everything still
 * in progress lives on Active Orders.
 */

type Preset = 'all' | 'today' | 'yesterday' | 'week' | 'month';

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

function presetRange(p: Preset, now = Date.now()): { from: number; to: number } | undefined {
  const today = startOfDay(now);
  switch (p) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'yesterday':
      return { from: addDays(today, -1), to: today };
    case 'week':
      return { from: startOfWeek(now), to: addDays(today, 1) };
    case 'month':
      return { from: startOfMonth(now), to: addDays(today, 1) };
    default:
      return undefined;
  }
}

const BADGE: Partial<Record<OrderStatus, { label: string; color: string; tint: string }>> = {
  delivered: { label: 'Delivered', color: colors.success, tint: colors.palette.green25 },
  cancelled: { label: 'Canceled', color: colors.primary, tint: colors.palette.red100 },
  refunded: { label: 'Refunded', color: colors.palette.amber700, tint: colors.palette.amber50 },
};

export function OrderHistoryScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierOrderHistory'>>();
  const { merchantId, merchantName } = params;

  const [preset, setPreset] = useState<Preset>('all');
  const [day, setDay] = useState<number | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const range = day !== null ? { from: day, to: addDays(day, 1) } : presetRange(preset);

  const load = useCallback(async () => {
    try {
      setError(null);
      setOrders(await listOrderHistory(merchantId, range));
    } catch {
      setError('Could not load your order history. Pull down to try again.');
      setOrders([]);
    }
    // `range` is derived from these two; depending on the object would refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, preset, day]);

  useEffect(() => {
    setOrders(null);
    void load();
  }, [load]);

  const loadOrderDays = useCallback(
    async (from: number, to: number) => {
      const rows = await listOrderHistory(merchantId, { from, to });
      return new Set(rows.map((o) => startOfDay(o.createdAt)));
    },
    [merchantId]
  );

  const groups = useMemo(() => {
    const byDay = new Map<number, Order[]>();
    for (const o of orders ?? []) {
      const key = startOfDay(o.createdAt);
      byDay.set(key, [...(byDay.get(key) ?? []), o]);
    }
    return [...byDay.entries()];
  }, [orders]);

  const delivered = orders?.filter((o) => o.status === 'delivered').length ?? 0;
  const cancelled = orders?.filter((o) => o.status !== 'delivered').length ?? 0;

  return (
    <Screen>
      <SupplierHeader title="Order History" subtitle={merchantName} onBack={() => navigation.goBack()} />

      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
        >
          {PRESETS.map((p) => {
            const on = day === null && p.key === preset;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setDay(null);
                  setPreset(p.key);
                }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text variant="body" style={on ? styles.chipTextOn : undefined} color={on ? colors.onPrimary : colors.palette.gray700}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.chipDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter by date"
          accessibilityState={{ selected: day !== null }}
          onPress={() => setDateOpen(true)}
          style={[styles.dateChip, day !== null && styles.chipOn]}
        >
          <Icon name="calendar" size={14} color={day !== null ? colors.onPrimary : colors.palette.gray700} />
          <Text variant="bodySm" color={day !== null ? colors.onPrimary : colors.palette.gray700}>
            {day !== null ? formatDate(day).replace(/ \d{4}$/, '') : 'Date'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <Text variant="body" style={styles.bold} color={colors.text}>
          {orders?.length ?? 0}
        </Text>
        <Text variant="bodySm" color={colors.textSecondary}>
          {orders?.length === 1 ? 'order' : 'orders'}
        </Text>
        <Text variant="h3" color={colors.border}>
          ·
        </Text>
        <View style={[styles.summaryDot, { backgroundColor: colors.palette.green600 }]} />
        <Text variant="bodySm" color={colors.textSecondary}>
          {delivered} delivered
        </Text>
        <Text variant="h3" color={colors.border}>
          ·
        </Text>
        <View style={[styles.summaryDot, { backgroundColor: colors.primary }]} />
        <Text variant="bodySm" color={colors.textSecondary}>
          {cancelled} cancelled
        </Text>
      </View>

      <ScrollView
        style={styles.list}
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
          [0, 1, 2].map((i) => <Skeleton key={i} height={68} borderRadius={radius['3xl']} />)
        ) : groups.length === 0 ? (
          <EmptyState
            title={error ? 'Something went wrong' : 'No finished orders'}
            message={
              error ??
              'Delivered and cancelled orders show up here. Orders still in progress are on Active Orders.'
            }
          />
        ) : (
          groups.map(([dayStart, rows]) => (
            <View key={dayStart} style={styles.group}>
              <View style={styles.dayHead}>
                <Text variant="eyebrow" color={colors.textMuted}>
                  {formatDayLabel(dayStart).toUpperCase()}
                </Text>
                <View style={styles.hairline} />
                <Text variant="caption" color={colors.textMuted}>
                  {rows.length} {rows.length === 1 ? 'order' : 'orders'}
                </Text>
              </View>
              {rows.map((o) => (
                <HistoryCard
                  key={o.id}
                  order={o}
                  expanded={open === o.id}
                  onToggle={() => setOpen(open === o.id ? null : o.id)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <DateFilterSheet
        visible={dateOpen}
        value={day}
        onClose={() => setDateOpen(false)}
        loadOrderDays={loadOrderDays}
        onApply={(d) => {
          setDay(d);
          if (d === null) setPreset('all');
          setDateOpen(false);
        }}
      />
    </Screen>
  );
}

function HistoryCard({ order, expanded, onToggle }: { order: Order; expanded: boolean; onToggle: () => void }) {
  const badge = BADGE[order.status] ?? BADGE.cancelled!;
  const delivered = order.status === 'delivered';
  const name = order.userName || order.address?.label || 'Customer';

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.cardHead}
      >
        <View style={styles.avatar}>
          <Text variant="h5" color={colors.onPrimary}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headText}>
          <View style={styles.nameRow}>
            <Text variant="h5" color={colors.textStrong} numberOfLines={1} style={styles.shrink}>
              {name}
            </Text>
            <View style={[styles.badge, { backgroundColor: badge.tint }]}>
              <Text variant="captionBold" color={badge.color}>
                {badge.label}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text variant="labelSm" color={colors.primary}>
              {order.ref}
            </Text>
            <Text variant="h3" color={colors.border}>
              ·
            </Text>
            <Text variant="microRegular" color={colors.textMuted}>
              {formatClock(order.createdAt)}
            </Text>
          </View>
        </View>
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <Icon name="chevronRight" size={16} color={colors.borderStrong} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.tracker}>
            <OrderProgress status={order.status} tone={delivered ? 'success' : 'danger'} filled />
          </View>

          <View style={styles.items}>
            <Text variant="eyebrow" color={colors.textMuted}>
              ITEMS ORDERED
            </Text>
            <View style={styles.itemList}>
              {order.items.map((it, i) => (
                <View key={`${it.menuItemId}-${i}`} style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <View style={styles.qty}>
                      <Text variant="labelSm" color={colors.palette.gray700}>
                        ×{it.qty}
                      </Text>
                    </View>
                    <Text variant="body" style={styles.regular} color={colors.palette.gray700} numberOfLines={1}>
                      {it.name}
                    </Text>
                  </View>
                  <Text variant="label" color={colors.textStrong}>
                    {formatMoney(it.lineTotal)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.totalRow}>
              <Text variant="bodySm" style={styles.bold} color={colors.textSecondary}>
                Total
              </Text>
              <Text variant="price" color={colors.primary}>
                {formatMoney(order.pricing.total)}
              </Text>
            </View>
          </View>

          {order.noteToRestaurant ? (
            <View style={[styles.banner, styles.noteBanner]}>
              <Icon name="note" size={14} color={colors.palette.amber600} />
              <Text variant="micro" color={colors.palette.amber800} style={styles.flex}>
                <Text variant="micro" style={styles.bold} color={colors.palette.amber800}>
                  Note:{' '}
                </Text>
                {order.noteToRestaurant}
              </Text>
            </View>
          ) : null}

          <View style={styles.etaRow}>
            <Icon name="clockSm" size={13} color={colors.textMuted} />
            <Text variant="microRegular" color={colors.textSecondary}>
              Est. delivery:{' '}
              <Text variant="labelSm" color={colors.palette.gray700}>
                {formatClockWindow(order.etaFrom, order.etaTo)}
              </Text>
            </Text>
          </View>

          <View style={[styles.banner, delivered ? styles.okBanner : styles.cancelBanner]}>
            <Icon name={delivered ? 'checkSm' : 'cross'} size={14} color={delivered ? colors.palette.green600 : colors.primary} />
            <Text variant="label" color={delivered ? colors.palette.green700 : colors.primary}>
              {delivered
                ? 'Order delivered successfully'
                : order.status === 'refunded'
                  ? 'Order refunded'
                  : 'Order canceled'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceAlt,
  },
  chipScroll: { flex: 1, flexGrow: 1 },
  chips: { gap: spacing[3], alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  chipTextOn: { fontFamily: fontFamily[700] },
  chipDivider: { width: 1, height: 22, backgroundColor: colors.border },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[3.5],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceAlt,
  },
  summaryDot: { width: 6, height: 6, borderRadius: radius.pill },
  bold: { fontFamily: fontFamily[700] },
  regular: { fontFamily: fontFamily[400] },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  list: { flex: 1, backgroundColor: colors.surfaceSunken },
  content: { padding: SCREEN_PADDING, gap: spacing[6], paddingBottom: spacing[12] },
  group: { gap: spacing[4] },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[1.5] },
  hairline: { flex: 1, height: 0.5, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    overflow: 'hidden',
    ...shadows.listCard,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  badge: { paddingHorizontal: spacing[3], paddingVertical: spacing[0.5], borderRadius: radius.pill },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], height: 26, paddingTop: spacing[0.5] },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    paddingVertical: 9,
    gap: spacing[2],
    alignItems: 'stretch',
  },
  tracker: { paddingHorizontal: spacing[6] },
  items: { paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[1.5] },
  itemList: { gap: spacing[3], paddingTop: spacing[3] },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexShrink: 1 },
  qty: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
    paddingTop: spacing[3.5],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[6],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  noteBanner: {
    alignItems: 'flex-start',
    backgroundColor: colors.palette.amber50,
    borderColor: colors.palette.amber200,
  },
  okBanner: { backgroundColor: colors.palette.green25, borderColor: colors.palette.green200 },
  cancelBanner: { backgroundColor: colors.palette.red100, borderColor: colors.palette.red300 },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
});
