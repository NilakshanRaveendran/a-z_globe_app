import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { Button, Chip, EmptyState, Icon, showToast, Skeleton, Text } from '@core/ui';
import { Sheet } from '@core/ui/Sheet';
import { Alert } from '@core/ui/alert';
import { formatClock } from '@core/utils/datetime';
import type { Order, OrderStatus } from '@modules/food/types';
import {
  advanceOrderStage,
  CANCEL_REASONS,
  canCancel,
  cancelOrder,
  listActiveOrders,
  listClosedOrders,
  nextStep,
  watchActiveOrders,
  watchClosedOrders,
} from '../services/orders';
import { customerName, displayRef, OrderCard } from './OrderCard';
import { businessStage } from '../services/orderSteps';

/**
 * The status chips and live order list of Active Orders (335:4972), shared
 * with the Orders tab, which runs it across every restaurant the account owns.
 *
 *   chips    #FFFFFF · pad 12 top / 4 bottom / 16 sides · 8 apart · pills
 *            pad 6/14 · 600 12/18 · on #D42B2B white · off #F3F4F6 #6B7280
 *   list     12 below the chips · cards 12 apart · 16 sides
 *   actions  per the OrderCard set (335:5771): a new order gets one
 *            full-width "Accept Order ›"; later steps get "Call customer" (1px
 *            #E5E7EB, r12, 14pt phone, 600 12/18 #374151) beside the red step
 *            button (r12, 40 tall, 700 12/18 white, 13pt chevron), 10 apart
 *
 * Live (S1): while the screen is focused the active orders stream in — a
 * Firestore listener on Firebase, a short poll of the shared store in demo —
 * so a customer's order appears without leaving the screen, with a toast.
 * The browser has no pull-to-refresh, so the web build also shows a
 * "Refresh" control and when the list last updated.
 *
 * The step button offers one of three milestones via `nextStep()`.
 * `advanceOrderStage()` records the legal database transitions behind each tap. Each step confirms itself with a toast (S12). Cancelling (not on
 * the frame, but a restaurant must be able to turn an order down) is a
 * confirmed text action at the end of the ETA row, with an optional reason.
 */

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export type OrderMerchant = { id: string; name: string };

const newestFirst = (a: Order, b: Order) => b.createdAt - a.createdAt;

/** What each step's toast says. */
function stepToast(order: Order, to: OrderStatus): string {
  const ref = `Order ${displayRef(order.ref)}`;
  switch (to) {
    case 'accepted':
      return `${ref} accepted`;
    case 'preparing':
      return `${ref} is being prepared`;
    case 'ready_for_pickup':
      return order.orderType === 'pickup' ? `${ref} is ready for the customer to collect` : `${ref} is ready for pickup`;
    case 'picked_up':
      return order.orderType === 'pickup' ? `${ref} collected · shown in Completed` : `${ref} picked up`;
    case 'delivered':
      return `${ref} ${order.orderType === 'pickup' ? 'collected' : 'delivered'} · shown in Completed`;
    case 'cancelled':
      return `${ref} cancelled · shown in Cancelled`;
    default:
      return `${ref} updated`;
  }
}

/** A refusal the person can act on, rather than a raw Firestore code. */
function moveErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string') {
    if (code.includes('permission-denied') || code.includes('failed-precondition')) {
      return 'It may already have moved on elsewhere. The list has been refreshed.';
    }
    if (code.includes('unavailable')) return 'You seem to be offline. Check your connection and try again.';
    return 'Check your connection and try again.';
  }
  return error instanceof Error && error.message ? error.message : 'Check your connection and try again.';
}

const isWeb = Platform.OS === 'web';

export function LiveOrderList({
  merchants,
  showMerchant = false,
}: {
  /** The restaurants whose orders to show; null while they are still loading. */
  merchants: OrderMerchant[] | null;
  /** Name the restaurant on each card — the Orders tab, when there is more than one. */
  showMerchant?: boolean;
}) {
  const [active, setActive] = useState<Order[] | null>(null);
  const [delivered, setDelivered] = useState<Order[] | null>(null);
  const [activeFailed, setActiveFailed] = useState(false);
  const [completedFailed, setCompletedFailed] = useState(false);
  const [filter, setFilter] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [working, setWorking] = useState<ReadonlySet<string>>(new Set());
  const [cancelling, setCancelling] = useState<Order | null>(null);
  // Mirrors `working` synchronously: two taps in one frame both see the state
  // from before the first, so the guard cannot rely on state alone.
  const busy = useRef(new Set<string>());
  // The active orders already seen — anything new after the first answer is
  // a customer's fresh order, and gets a toast.
  const seen = useRef<Set<string> | null>(null);
  // Only the newest one-shot read may write — a slow earlier one must not overwrite it.
  const loadSeq = useRef(0);
  const completedSeq = useRef(0);
  const listRef = useRef<ScrollView>(null);
  const chipsRef = useRef<ScrollView>(null);
  const chipX = useRef(new Map<string, number>());

  // S26: a new filter starts at the top of its list, with its chip in view.
  const chooseFilter = (key: string) => {
    setFilter(key);
    listRef.current?.scrollTo({ y: 0, animated: false });
    const x = chipX.current.get(key);
    if (x !== undefined) chipsRef.current?.scrollTo({ x: Math.max(0, x - SCREEN_PADDING), animated: true });
  };

  const merchantKey = merchants?.map((m) => `${m.id}\u0000${m.name}`).join('\u0001') ?? null;
  const ids = useMemo(
    () => (merchants ?? []).map((m) => m.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [merchantKey]
  );
  const names = useMemo(
    () => new Map((merchants ?? []).map((m) => [m.id, m.name])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [merchantKey]
  );

  const receiveActive = useCallback((rows: Order[]) => {
    const before = seen.current;
    if (before) {
      const fresh = rows.filter((o) => o.status === 'new' && !before.has(o.id));
      if (fresh.length === 1) showToast(`New order ${displayRef(fresh[0]!.ref)} from ${customerName(fresh[0]!)}`);
      else if (fresh.length > 1) showToast(`${fresh.length} new orders`);
    }
    seen.current = new Set(rows.map((o) => o.id));
    // Firestore can remove a pending delivery from its active query before
    // the write resolves. Keep its busy card until we can open Completed.
    setActive((prev) => [
      ...rows,
      ...(prev ?? []).filter((o) => busy.current.has(o.id) && !rows.some((row) => row.id === o.id)),
    ].sort(newestFirst));
    setActiveFailed(false);
    setUpdatedAt(Date.now());
  }, []);

  const receiveCompleted = useCallback((rows: Order[]) => {
    setDelivered(rows.sort(newestFirst));
    setCompletedFailed(false);
    setUpdatedAt(Date.now());
  }, []);

  /** Each feed has its own revision so neither stale reads nor another feed's
   * snapshot can overwrite it. Failed reads preserve the last known orders. */
  const refresh = useCallback(async () => {
    if (!merchants) return;
    const activeToken = ++loadSeq.current;
    const completedToken = ++completedSeq.current;
    await Promise.all([
      Promise.all(ids.map(listActiveOrders)).then((rows) => {
        if (activeToken === loadSeq.current) receiveActive(rows.flat().sort(newestFirst));
      }).catch(() => {
        if (activeToken === loadSeq.current) setActiveFailed(true);
      }),
      Promise.all(ids.map(listClosedOrders)).then((rows) => {
        if (completedToken === completedSeq.current) receiveCompleted(rows.flat());
      }).catch(() => {
        if (completedToken === completedSeq.current) setCompletedFailed(true);
      }),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantKey, ids, receiveActive, receiveCompleted]);

  useFocusEffect(
    useCallback(() => {
      if (!merchants) return;
      let live = true;
      const stopActive = watchActiveOrders(ids, (rows) => {
        if (!live) return;
        loadSeq.current += 1;
        receiveActive(rows);
      }, () => live && setActiveFailed(true));
      const stopCompleted = watchClosedOrders(ids, (rows) => {
        if (!live) return;
        completedSeq.current += 1;
        receiveCompleted(rows);
      }, () => live && setCompletedFailed(true));
      return () => {
        live = false;
        loadSeq.current += 1;
        completedSeq.current += 1;
        stopActive();
        stopCompleted();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [merchantKey, ids, receiveActive, receiveCompleted])
  );

  const visible = useMemo(() => {
    if (filter === 'completed') return (delivered ?? []).filter((o) => o.status === 'delivered');
    if (filter === 'cancelled') return (delivered ?? []).filter((o) => o.status === 'cancelled' || o.status === 'refunded');
    return (active ?? []).filter((o) => filter === 'active' || businessStage(o) === filter);
  }, [active, delivered, filter]);

  const setBusy = (id: string, on: boolean) => {
    if (on) busy.current.add(id);
    else busy.current.delete(id);
    setWorking(new Set(busy.current));
  };

  const move = async (order: Order, to: OrderStatus, reason?: string) => {
    if (busy.current.has(order.id)) return;
    setBusy(order.id, true);
    // Keep the real status visible while saving. The write returns the actual
    // timeline; never invent an optimistic one that omits intermediate steps.
    loadSeq.current += 1;
    completedSeq.current += 1;
    try {
      if (to === 'cancelled') {
        const timeline = await cancelOrder(order, reason);
        const updated: Order = { ...order, status: 'cancelled', timeline, cancelReason: reason };
        completedSeq.current += 1;
        setDelivered((prev) => [updated, ...(prev ?? []).filter((o) => o.id !== updated.id)].sort(newestFirst));
        setOpen(updated.id);
        chooseFilter('cancelled');
        setActive((prev) => prev?.filter((o) => o.id !== order.id) ?? null);
      } else {
        const updated = await advanceOrderStage(order, to);
        loadSeq.current += 1;
        completedSeq.current += 1;
        if (updated.status === 'delivered') {
          setDelivered((prev) => [updated, ...(prev ?? []).filter((o) => o.id !== updated.id)].sort(newestFirst));
          setActive((prev) => prev?.filter((o) => o.id !== updated.id) ?? null);
          setOpen(updated.id);
          chooseFilter('completed');
        } else {
          setActive((prev) => prev?.map((o) => o.id === updated.id ? updated : o) ?? null);
          // A filtered card follows the milestone that was just saved.
          if (filter !== 'active') chooseFilter(businessStage(updated) ?? 'active');
        }
      }
      showToast(stepToast(order, to));
    } catch (error) {
      Alert.alert(`Couldn't update ${displayRef(order.ref)}`, moveErrorMessage(error));
    } finally {
      // Keep the button busy until the list reflects the write, so a second
      // tap can never send a timeline the server has already moved past.
      await refresh();
      setBusy(order.id, false);
    }
  };

  const callCustomer = (order: Order) => {
    if (!order.userPhone) return;
    void Linking.openURL(`tel:${order.userPhone.replace(/[^\d+]/g, '')}`).catch(() =>
      Alert.alert(`Call ${customerName(order)}`, order.userPhone)
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const failed = (filter === 'completed' || filter === 'cancelled') ? completedFailed : activeFailed;
  const loading = merchants === null || (!failed && ((filter === 'completed' || filter === 'cancelled') ? delivered === null : active === null));

  return (
    <>
      <View style={styles.chipBar}>
        <ScrollView
          ref={chipsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => chooseFilter(f.key)}
                onLayout={(e) => chipX.current.set(f.key, e.nativeEvent.layout.x)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text variant="label" color={on ? colors.onPrimary : colors.textSecondary}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {isWeb ? (
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, failed && styles.liveDotOff]} />
            <Text variant="caption" color={colors.textMuted} style={styles.flex} numberOfLines={1}>
              {failed ? 'Not updating' : updatedAt ? `Live · updated ${formatClock(updatedAt)}` : 'Connecting…'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh orders"
              accessibilityState={{ busy: refreshing }}
              disabled={refreshing}
              onPress={() => void onRefresh()}
              style={({ pressed }) => [styles.refresh, (pressed || refreshing) && styles.pressed]}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.palette.gray700} style={styles.spinner} />
              ) : null}
              <Text variant="bodySm" color={colors.palette.gray700}>
                Refresh
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => void onRefresh()} />
        }
      >
        {failed && visible.length > 0 ? (
          <Text accessibilityRole="alert" variant="bodySm" color={colors.primary}>
            Could not update these orders. Showing the last known status. Refresh to try again.
          </Text>
        ) : null}
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={77} borderRadius={radius['3xl']} />)
        ) : visible.length === 0 ? (
          <EmptyState
            title={failed ? 'Something went wrong' : filter === 'active' ? 'No active orders' : 'No orders here'}
            message={
              failed
                ? `Could not load your orders. ${isWeb ? 'Tap Refresh' : 'Pull down'} to try again.`
                : filter === 'active'
                  ? 'When a customer places an order, it shows up here straight away.'
                  : filter === 'completed'
                    ? 'Completed deliveries and collected takeaway orders will appear here.'
                    : filter === 'cancelled' ? 'Cancelled and refunded orders will appear here.' : 'Nothing at this stage right now.'
            }
          />
        ) : (
          visible.map((order) => {
            const step = nextStep(order.status, order.orderType);
            const isBusy = working.has(order.id);
            return (
              <OrderCard
                key={order.id}
                order={order}
                expanded={open === order.id}
                onToggle={() => setOpen(open === order.id ? null : order.id)}
                meta={showMerchant ? names.get(order.merchantId) || order.merchantName : undefined}
                etaAction={
                  canCancel(order.status) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isBusy }}
                      disabled={isBusy}
                      hitSlop={8}
                      onPress={() => setCancelling(order)}
                      style={isBusy && styles.busy}
                    >
                      <Text variant="labelSm" color={colors.primary}>
                        Cancel order
                      </Text>
                    </Pressable>
                  ) : null
                }
                footer={
                  step ? (
                    <>
                      {order.status !== 'new' && order.userPhone ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Call ${customerName(order)}`}
                          onPress={() => callCustomer(order)}
                          style={({ pressed }) => [styles.button, styles.call, pressed && styles.pressed]}
                        >
                          <Icon name="phone" size={14} color={colors.palette.gray700} />
                          <Text variant="label" color={colors.palette.gray700} numberOfLines={1}>
                            Call customer
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${step.label}, ${displayRef(order.ref)}`}
                        accessibilityState={{ disabled: isBusy, busy: isBusy }}
                        disabled={isBusy}
                        onPress={() => void move(order, step.to)}
                        style={({ pressed }) => [styles.button, styles.step, (pressed || isBusy) && styles.busy]}
                      >
                        <Text variant="labelBold" color={colors.onPrimary} style={styles.stepLabel} numberOfLines={1}>
                          {step.label}
                        </Text>
                        {isBusy ? (
                          <ActivityIndicator size="small" color={colors.onPrimary} style={styles.spinner} />
                        ) : (
                          <Icon name="chevronRight" size={13} color={colors.onPrimary} />
                        )}
                      </Pressable>
                    </>
                  ) : null
                }
              />
            );
          })
        )}
      </ScrollView>

      <CancelOrderSheet
        order={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={(order, reason) => {
          setCancelling(null);
          void move(order, 'cancelled', reason);
        }}
      />
    </>
  );
}

/**
 * "Cancel #1042?" — cancelling cannot be undone and the customer sees it at
 * once, so it is never a single stray tap. A reason is optional; when given
 * it is stored on the order and shown on the customer's tracker (S33).
 */
function CancelOrderSheet({
  order,
  onClose,
  onConfirm,
}: {
  order: Order | null;
  onClose: () => void;
  onConfirm: (order: Order, reason?: string) => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  // Keep drawing the last order while the sheet slides away.
  const last = useRef<Order | null>(order);
  if (order) last.current = order;
  const shown = order ?? last.current;
  const close = () => {
    setReason(null);
    onClose();
  };
  return (
    <Sheet visible={!!order} onClose={close} title={shown ? `Cancel ${displayRef(shown.ref)}?` : 'Cancel order?'}>
      {shown ? (
        <View style={styles.sheetBody}>
          <Text variant="bodyLg" color={colors.textSecondary}>
            {customerName(shown)} will see that the order was cancelled. This can't be undone.
          </Text>
          <Text variant="label" color={colors.palette.gray700}>
            Reason (optional)
          </Text>
          <View style={styles.reasons}>
            {CANCEL_REASONS.map((r) => (
              <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
            ))}
          </View>
          <View style={styles.sheetActions}>
            <Button label="Keep order" variant="secondary" onPress={close} fullWidth={false} style={styles.sheetButton} />
            <Button
              label="Cancel order"
              onPress={() => {
                if (!order) return;
                const chosen = reason ?? undefined;
                setReason(null);
                onConfirm(order, chosen);
              }}
              fullWidth={false}
              style={styles.sheetButton}
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chipBar: {
    backgroundColor: colors.surface,
    paddingTop: spacing[4],
    paddingBottom: spacing[1.5],
  },
  // alignItems keeps each pill its natural height: a horizontal ScrollView
  // stretches children across the cross axis.
  chips: {
    gap: spacing[3],
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing[1.5],
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[2.5],
  },
  liveDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.success },
  liveDotOff: { backgroundColor: colors.textMuted },
  flex: { flex: 1, minWidth: 0 },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  list: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  button: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderRadius: radius.xl,
  },
  call: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Wide enough for the longest step, "Mark as Picked Up", on a 320pt phone;
  // at the frame's width both buttons still split the row evenly.
  step: { backgroundColor: colors.primary, minWidth: 140 },
  stepLabel: { flexShrink: 1 },
  spinner: { width: 13, height: 13, transform: [{ scale: 0.7 }] },
  busy: { opacity: 0.6 },
  pressed: { opacity: 0.7 },
  sheetBody: { paddingHorizontal: spacing[8], paddingTop: spacing[6], gap: spacing[4] },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sheetActions: { flexDirection: 'row', gap: spacing[3.5], paddingTop: spacing[4] },
  sheetButton: { flex: 1 },
});
