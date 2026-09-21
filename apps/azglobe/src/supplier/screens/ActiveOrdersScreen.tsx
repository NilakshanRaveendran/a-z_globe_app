import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, ScreenHeader, Skeleton, Text } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import { formatClock } from '@core/utils/datetime';
import type { Order, OrderStatus } from '@modules/food/types';
import { trackerStage } from '@modules/food/types';
import type { RootStackParamList } from '@app/navigation/types';
import { addressSubtitle } from '@modules/food/services/addresses';
import {
  ACTIVE_STATUSES,
  advanceOrder,
  canCancel,
  cancelOrder,
  listMerchantOrders,
  nextStep,
  STATUS_STYLE,
} from '../services/orders';

/**
 * Active Orders — Figma 335:4972.
 *
 *   title    "Active Orders" Urbanist 700 22/33 · restaurant name 400 13/19.5 #D42B2B
 *   filters  Active · New · Accepted · Preparing · Picked up · Delivered
 *   card     avatar initial · customer · "#1042 · 8:02 PM" · status badge ·
 *            "Items Ordered" eyebrow · item rows · Total · note banner ·
 *            3-node progress (Restaurant / Picked up / Delivered) · actions
 *
 * The action button is derived from the order's status via `nextStep()`, which
 * mirrors the state machine in firestore.rules — so the button can only ever
 * offer a move the database will accept.
 */
const FILTERS: Array<{ key: string; label: string; statuses?: OrderStatus[] }> = [
  { key: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  { key: 'new', label: 'New', statuses: ['new'] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { key: 'preparing', label: 'Preparing', statuses: ['preparing'] },
  { key: 'picked_up', label: 'Picked up', statuses: ['picked_up'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
];

const PROGRESS = ['Restaurant', 'Picked up', 'Delivered'];


export function ActiveOrdersScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierOrders'>>();
  const { merchantId, merchantName } = params;

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await listMerchantOrders(merchantId));
    } catch {
      setOrders([]);
    }
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const spec = FILTERS.find((f) => f.key === filter);
    if (!orders) return [];
    return spec?.statuses ? orders.filter((o) => spec.statuses!.includes(o.status)) : orders;
  }, [orders, filter]);

  const move = async (order: Order, to: OrderStatus) => {
    setWorking(order.id);
    // Optimistic, then reconciled by the reload. A refusal (an illegal
    // transition, or someone else moved it first) snaps back to the truth.
    setOrders((prev) =>
      prev ? prev.map((o) => (o.id === order.id ? { ...o, status: to } : o)) : prev
    );
    try {
      await (to === 'cancelled' ? cancelOrder(order) : advanceOrder(order, to));
    } finally {
      setWorking(null);
      void load();
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Active Orders"
        subtitle={merchantName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        horizontal
        style={styles.filterRow}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f.key)}
              style={[styles.filter, on && styles.filterOn]}
            >
              <Text variant="bodySm" color={on ? colors.onPrimary : colors.textSecondary}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
          <View style={styles.list}>
            <Skeleton height={220} />
            <Skeleton height={220} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No orders here"
            message={
              filter === 'active'
                ? 'New orders appear here the moment a customer places one.'
                : 'Nothing at this stage right now.'
            }
          />
        ) : (
          <View style={styles.list}>
            {visible.map((order) => {
              const badge = STATUS_STYLE[order.status];
              const step = nextStep(order.status);
              const stage = trackerStage(order.status);
              // Orders placed before `userName` existed have none; fall back to
              // the reference rather than rendering an empty row.
              const customer = order.userName?.trim() || order.address?.label || order.ref;

              return (
                <View key={order.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.avatar}>
                      <Text variant="h5" color={colors.onPrimary}>
                        {(customer || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.headText}>
                      <Text variant="h5" color={colors.textHeading} numberOfLines={1}>
                        {customer}
                      </Text>
                      <View style={styles.refRow}>
                        <Text variant="labelSm" color={colors.primary}>
                          {order.ref}
                        </Text>
                        <Text variant="microRegular" color={colors.border}>
                          ·
                        </Text>
                        <Text variant="microRegular" color={colors.textMuted}>
                          {formatClock(order.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.tint }]}>
                      <Text variant="captionBold" color={badge.color}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <Text variant="eyebrow" color={colors.textMuted} style={styles.eyebrow}>
                    Items Ordered
                  </Text>
                  {order.items.map((item, i) => (
                    <View key={`${order.id}-${i}`} style={styles.itemRow}>
                      <Text variant="body" color={colors.palette.gray700} style={styles.itemName}>
                        {item.name}
                      </Text>
                      <Text variant="labelSm" color={colors.palette.gray700}>
                        ×{item.qty}
                      </Text>
                      <Text variant="label" color={colors.textStrong}>
                        {formatMoney(item.lineTotal)}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.totalRow}>
                    <Text variant="label" color={colors.textSecondary}>
                      Total
                    </Text>
                    <Text variant="price" color={colors.primary}>
                      {formatMoney(order.pricing.total)}
                    </Text>
                  </View>

                  {order.noteToRestaurant ? (
                    <View style={styles.note}>
                      <Text variant="labelSm" color="#92400E">
                        Note: {order.noteToRestaurant}
                      </Text>
                    </View>
                  ) : null}

                  {/* Where it goes. Snapshotted onto the order at checkout —
                      the restaurant cannot read the customer's address book. */}
                  {order.address ? (
                    <View style={styles.addressRow}>
                      <Icon name="mapPin" size={14} color={colors.textSecondary} />
                      <View style={styles.addressText}>
                        <Text variant="label" color={colors.text}>
                          {addressSubtitle(order.address)}
                        </Text>
                        {[
                          order.address.apt,
                          order.address.buildingName,
                          order.address.landmark,
                        ].filter(Boolean).length ? (
                          <Text variant="microRegular" color={colors.textSecondary}>
                            {[order.address.apt, order.address.buildingName, order.address.landmark]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ) : null}
                        {order.address.instructions ? (
                          <Text variant="microRegular" color={colors.textSecondary}>
                            “{order.address.instructions}”
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.progress}>
                    {PROGRESS.map((label, i) => (
                      <Text
                        key={label}
                        variant="caption"
                        color={i <= stage ? colors.success : colors.textMuted}
                      >
                        {label}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.actions}>
                    {step ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={working === order.id}
                        onPress={() => void move(order, step.to)}
                        style={[styles.primaryBtn, working === order.id && styles.btnBusy]}
                      >
                        <Text variant="labelSm" color={colors.onPrimary} align="center">
                          {step.label}
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.doneBtn}>
                        <Text variant="labelSm" color={colors.textSecondary} align="center">
                          {badge.label}
                        </Text>
                      </View>
                    )}

                    {canCancel(order.status) ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={working === order.id}
                        onPress={() =>
                          // Cancelling cannot be undone and the customer is
                          // told at once, so it is never a single stray tap.
                          Alert.alert(
                            `Cancel ${order.ref}?`,
                            `${order.userName || 'The customer'} will be told the order was cancelled.`,
                            [
                              { text: 'Keep order', style: 'cancel' },
                              {
                                text: 'Cancel order',
                                style: 'destructive',
                                onPress: () => void move(order, 'cancelled'),
                              },
                            ]
                          )
                        }
                        style={styles.secondaryBtn}
                      >
                        <Text variant="label" color={colors.palette.gray700}>
                          Cancel
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // alignItems keeps each pill its natural height: a horizontal ScrollView
  // stretches children across the cross axis, which made them full-height bars.
  filterRow: { flexGrow: 0 },
  filters: {
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing[3],
    paddingBottom: spacing[4],
    alignItems: 'center',
  },
  filter: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  filterOn: { backgroundColor: colors.primary },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[12] },
  list: { gap: spacing[4] },
  card: {
    padding: spacing[6],
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 2px 8px 0px rgba(0,0,0,0.06)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  badge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
  },
  eyebrow: { marginTop: spacing[6], marginBottom: spacing[2] },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  itemName: { flex: 1 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  note: {
    marginTop: spacing[4],
    padding: spacing[3.5],
    borderRadius: radius.lg,
    backgroundColor: '#FEF3C7',
  },
  addressRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  addressText: { flex: 1, gap: spacing[0.5] },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[5],
  },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[5] },
  primaryBtn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  doneBtn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  btnBusy: { opacity: 0.6 },
  secondaryBtn: {
    height: 40,
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
