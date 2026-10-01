import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, fontFamily, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, Text } from '@core/ui';
import {
  addDays,
  formatDate,
  formatDayLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '@core/utils/datetime';
import type { Order } from '@modules/food/types';
import type { RootStackParamList } from '@app/navigation/types';
import { listOrderHistory } from '../services/orders';
import { SupplierHeader } from '../components/SupplierHeader';
import { DateFilterSheet } from '../components/DateFilterSheet';
import { OrderCard } from '../components/OrderCard';

/**
 * Order History — Figma 346:2826 (collapsed) and 346:3748 (cards expanded).
 *
 *   header   SupplierHeader — "Order History" + restaurant name in #D42B2B
 *   chips    #FFFFFF · pad 12/16 · 8 apart · 0.51px #F3F4F6 rule below ·
 *            pills pad 6/14 · on #D42B2B 700 13/19.5 white · off #F3F4F6
 *            500 13/19.5 #374151 · 1×22 #E5E7EB divider · "Date" pill pad 6/10,
 *            5 gap, 14pt calendar, 500 12/18 #374151
 *   summary  #FFFFFF · 0.51px #F3F4F6 · pad 10/16 · 6 apart · "10" 700 13/19.5
 *            #1F2937 + "orders" 500 12/18 #6B7280 · "·" 16/24 #E5E7EB ·
 *            6pt dots #16A34A delivered / #D42B2B cancelled, 4 to their label
 *   list     #FFFFFF · 12 top · 16 sides · days 16 apart · cards 12 apart
 *   day      pad 0/4 · "TODAY" 700 11/16.5 +0.55 #9CA3AF · 0.49px #E5E7EB
 *            rule · "3 orders" 500 10/15 #9CA3AF, 8 apart
 *   cards    OrderCard — tracker green end to end when delivered, red when
 *            cancelled, then the outcome banner
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

/** Computed at load time, so "Today" is still today after midnight. */
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
  // Only the newest request may write: tapping Today then All quickly must not
  // let a slow Today answer land under the All chip.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const token = ++loadSeq.current;
    const range = day !== null ? { from: day, to: addDays(day, 1) } : presetRange(preset);
    try {
      const rows = await listOrderHistory(merchantId, range);
      if (token !== loadSeq.current) return;
      setError(null);
      setOrders(rows);
    } catch {
      if (token !== loadSeq.current) return;
      setError('Could not load your order history. Pull down to try again.');
      setOrders([]);
    }
  }, [merchantId, preset, day]);

  // On focus as well as on every filter change — an order finished on Active
  // Orders belongs here as soon as you come back.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const choosePreset = (p: Preset) => {
    // Re-tapping the chip already on changes nothing, so nothing would reload.
    if (p === preset && day === null) return;
    setDay(null);
    setPreset(p);
    setOrders(null);
  };

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
  const cancelled = orders?.filter((o) => o.status === 'cancelled').length ?? 0;
  const refunded = orders?.filter((o) => o.status === 'refunded').length ?? 0;
  const total = orders?.length ?? 0;

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
                onPress={() => choosePreset(p.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text
                  variant="body"
                  style={on ? styles.bold : undefined}
                  color={on ? colors.onPrimary : colors.palette.gray700}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.chipDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={day !== null ? `Filtered to ${formatDate(day)}. Change date` : 'Filter by date'}
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
        <View style={styles.summaryCount}>
          <Text variant="body" style={styles.bold} color={colors.text}>
            {total}
          </Text>
          <Text variant="bodySm" color={colors.textSecondary}>
            {total === 1 ? 'order' : 'orders'}
          </Text>
        </View>
        <Text variant="h3" color={colors.border} style={styles.regular}>
          ·
        </Text>
        <View style={styles.summaryStat}>
          <View style={[styles.summaryDot, { backgroundColor: colors.palette.green600 }]} />
          <Text variant="bodySm" color={colors.textSecondary}>
            {delivered} delivered
          </Text>
        </View>
        <Text variant="h3" color={colors.border} style={styles.regular}>
          ·
        </Text>
        <View style={styles.summaryStat}>
          <View style={[styles.summaryDot, { backgroundColor: colors.primary }]} />
          <Text variant="bodySm" color={colors.textSecondary}>
            {cancelled} cancelled
          </Text>
        </View>
        {refunded ? (
          <>
            <Text variant="h3" color={colors.border} style={styles.regular}>
              ·
            </Text>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryDot, { backgroundColor: colors.textSecondary }]} />
              <Text variant="bodySm" color={colors.textSecondary}>
                {refunded} refunded
              </Text>
            </View>
          </>
        ) : null}
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
          [0, 1, 2].map((i) => <Skeleton key={i} height={77} borderRadius={radius['3xl']} />)
        ) : groups.length === 0 ? (
          <EmptyState
            title={error ? 'Something went wrong' : 'No finished orders'}
            message={
              error ??
              (day !== null || preset !== 'all'
                ? 'No delivered or cancelled orders in this period.'
                : 'Delivered and cancelled orders show up here. Orders still in progress are on Active Orders.')
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
                <OrderCard
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
          if (d !== day) setOrders(null);
          setDay(d);
          if (d === null) setPreset('all');
          setDateOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 0.51,
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
    flexWrap: 'wrap',
    gap: spacing[2.5],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[3.5],
    backgroundColor: colors.surface,
    borderBottomWidth: 0.51,
    borderBottomColor: colors.surfaceAlt,
  },
  summaryCount: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  summaryStat: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  summaryDot: { width: 6, height: 6, borderRadius: radius.pill },
  bold: { fontFamily: fontFamily[700] },
  regular: { fontFamily: fontFamily[400] },
  list: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
    gap: spacing[6],
  },
  group: { gap: spacing[4] },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[1.5] },
  hairline: { flex: 1, height: 0.5, backgroundColor: colors.border },
});
