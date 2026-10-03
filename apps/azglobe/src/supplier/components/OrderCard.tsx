import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fontFamily, radius, shadows, spacing } from '@core/theme';
import { Icon, Text, type IconName } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import { formatClockWindow } from '@core/utils/datetime';
import { lastReachedStatus, type Order, type OrderStatus } from '@modules/food/types';
import { addressLine } from '@modules/food/services/addresses';
import { formatOrderTime } from '@modules/food/services/orders';
import { ACTIVE_STATUSES, STATUS_STYLE } from '../services/orders';
import { initials } from '@core/utils/text';

/**
 * The provider order card — Figma OrderCard set (335:5771), used by Active
 * Orders (335:4972), Order History (346:3748) and the Orders tab.
 *
 *   card     #FFFFFF · r16 · 1px #F3F4F6 · shadow 0 1 4 8%
 *   head     pad 14/16 · gap 12 · 40pt #D42B2B avatar, initial 700 14/21 white ·
 *            name 700 14/21 #111827 · status pill pad 2/8 600 10/15 (tones in
 *            STATUS_STYLE) · "#1042" 600 11 #D42B2B · "·" 16/24 #E5E7EB ·
 *            "8:02 PM" 400 11 #9CA3AF · 16pt #9CA3AF chevron (down when open)
 *   body     1px #F3F4F6 rule · pad 9 top · 5 between blocks
 *   tracker  36pt stops (label 500 10/15, 6 below) joined by 3pt pill bars:
 *            done #22C55E · current #D42B2B · pending #E5E7EB/#9CA3AF.
 *            "Restaurant" is current from accepted through ready, "Picked up"
 *            only once the rider has it (S5); a cancelled order is red up to
 *            where it stopped, never through "Delivered" (S33)
 *   chips    how the customer chose to be served — payment, Priority,
 *            scheduled time, utensils (C11) — pad 3/8 r999 600 11/16.5
 *   items    pad 12/16/4 · "ITEMS ORDERED" 700 11/16.5 +0.55 #9CA3AF ·
 *            rows 8 apart, ×n chip #F3F4F6 r6 pad 2/6 600 11 #374151 ·
 *            name 400 13/19.5 #374151 · price 600 12/18 #111827 ·
 *            12 then 1px #F3F4F6 rule, 10 then Total 700 12 #6B7280 / 700 13 #D42B2B
 *   note     #FFFBEB · 1px #FDE68A · r12 · pad 10/12 · 14pt #D97706 glyph ·
 *            "Note:" 700 11/16.5 #92400E + 400
 *   eta      41 tall · pad 12/16 · 13pt clock · 400 11 #6B7280 + 600 #374151
 *   outcome  r12 · pad 10/12 · 14pt glyph · 600 12/18 — green delivered
 *            (#F0FDF4 / #BBF7D0 / #15803D), red cancelled (#FFEAEA / #FF7A7A / #D42B2B)
 *
 * The meta row's trailing slot (an empty 39pt text on the frame) carries the
 * item count, or the restaurant on the Orders tab. An order from another day
 * says which ("Yesterday, 8:02 PM") (S19). The delivery address and any chosen
 * options are not on the frame; the kitchen needs both, so they are set in the
 * frame's own ETA and caption styles.
 */

/** "AZG-1042" → "#1042" — the short reference the frames print. */
export function displayRef(ref: string): string {
  if (!ref) return '';
  return ref.startsWith('#') ? ref : `#${ref.replace(/^[A-Za-z]+-/, '')}`;
}

export function customerName(order: Order): string {
  return order.userName?.trim() || 'Customer';
}

export function itemCount(order: Order): string {
  const n = order.items.reduce((sum, it) => sum + it.qty, 0);
  return `${n} ${n === 1 ? 'item' : 'items'}`;
}

/** The pill's words — a takeaway is collected rather than delivered. */
export function statusLabel(status: OrderStatus, orderType?: Order['orderType']): string {
  if (orderType === 'pickup') {
    if (status === 'ready_for_pickup') return 'Ready to Collect';
    if (status === 'picked_up' || status === 'delivered') return 'Collected';
  }
  if (status === 'accepted' || status === 'preparing' || status === 'ready_for_pickup') return 'Restaurant';
  return STATUS_STYLE[status].label;
}

export function StatusPill({ status, orderType }: { status: OrderStatus; orderType?: Order['orderType'] }) {
  const tone = STATUS_STYLE[status];
  return (
    <View style={[styles.pill, { backgroundColor: tone.tint }]}>
      <Text variant="captionBold" color={tone.color} numberOfLines={1}>
        {statusLabel(status, orderType)}
      </Text>
    </View>
  );
}

type StopTone = 'done' | 'current' | 'pending' | 'failed';

/**
 * How each of the three stops reads (335:5771 variants, corrected per S5):
 * the kitchen's stop stays current through accepted, preparing and ready —
 * the food has not left — and "Picked up" turns current only once the rider
 * has it. A cancelled or refunded order is red up to the stop it reached.
 */
function stopTones(order: Pick<Order, 'status' | 'timeline' | 'orderType'>): [StopTone, StopTone, StopTone] {
  const failed = order.status === 'cancelled' || order.status === 'refunded';
  const reached = lastReachedStatus(order);
  if (order.orderType === 'pickup') {
    // Kitchen → Ready → Collected; no rider in between.
    if (failed) return reached === 'ready_for_pickup' ? ['failed', 'failed', 'pending'] : ['failed', 'pending', 'pending'];
    switch (reached) {
      case 'new':
        return ['pending', 'pending', 'pending'];
      case 'accepted':
      case 'preparing':
        return ['current', 'pending', 'pending'];
      case 'ready_for_pickup':
        return ['done', 'current', 'pending'];
      default:
        return ['done', 'done', 'done'];
    }
  }
  if (failed) {
    if (reached === 'delivered') return ['failed', 'failed', 'failed'];
    if (reached === 'picked_up') return ['failed', 'failed', 'pending'];
    return ['failed', 'pending', 'pending'];
  }
  switch (reached) {
    case 'new':
      return ['pending', 'pending', 'pending'];
    case 'accepted':
    case 'preparing':
    case 'ready_for_pickup':
      return ['current', 'pending', 'pending'];
    case 'picked_up':
      return ['done', 'current', 'pending'];
    default:
      return ['done', 'done', 'done'];
  }
}

const STOPS = [
  { label: 'Restaurant', icon: 'utensils' },
  { label: 'Picked up', icon: 'person' },
  { label: 'Delivered', icon: 'home' },
] as const;

const PICKUP_STOPS = [
  { label: 'Restaurant', icon: 'utensils' },
  { label: 'Ready', icon: 'checkCircle' },
  { label: 'Collected', icon: 'store' },
] as const;

const STOP_FILL: Record<StopTone, string> = {
  done: colors.success,
  current: colors.primary,
  failed: colors.primary,
  pending: colors.border,
};
const STOP_LABEL: Record<StopTone, string> = {
  done: colors.success,
  current: colors.primary,
  failed: colors.primary,
  pending: colors.textMuted,
};

/**
 * The three-stop Status Loader. Stops keep their natural width and the bars
 * flex, so the labels stay spread at any card width.
 */
export function OrderTracker({ order }: { order: Pick<Order, 'status' | 'timeline' | 'orderType'> }) {
  const tones = stopTones(order);
  const stops = order.orderType === 'pickup' ? PICKUP_STOPS : STOPS;
  return (
    <View style={styles.tracker} accessible accessibilityLabel={`Order status: ${statusLabel(order.status, order.orderType)}`}>
      {stops.map((stop, i) => {
        const tone = tones[i]!;
        const after = tones[i + 1];
        // A bar is filled once the stop before it is behind the order; red
        // only between two stops the cancelled order reached.
        const bar =
          tone === 'done' ? colors.success : tone === 'failed' && after === 'failed' ? colors.primary : null;
        return (
          <Fragment key={stop.label}>
            <View style={styles.stop}>
              <View style={[styles.stopCircle, { backgroundColor: STOP_FILL[tone] }]}>
                <Icon name={stop.icon} size={20} color={colors.onPrimary} />
              </View>
              <Text variant="caption" color={STOP_LABEL[tone]} numberOfLines={1}>
                {stop.label}
              </Text>
            </View>
            {i < stops.length - 1 ? (
              <View style={[styles.bar, bar ? { backgroundColor: bar } : null]} />
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

/** "Order cancelled by the customer" / "Order cancelled · Items out of stock". */
function cancelSummary(order: Order): string {
  const entry = [...(order.timeline ?? [])].reverse().find((t) => t.status === 'cancelled');
  if (entry?.by === 'customer') return 'Order cancelled by the customer';
  return order.cancelReason ? `Order cancelled · ${order.cancelReason}` : 'Order cancelled';
}

/**
 * The customer's service choices, as chips the kitchen can read at a glance
 * (C11): how they pay, Priority, a scheduled time, utensils.
 */
function serviceChips(order: Order): Array<{ label: string; icon: IconName; accent?: boolean }> {
  const chips: Array<{ label: string; icon: IconName; accent?: boolean }> = [];
  if (order.orderType === 'pickup') chips.push({ label: 'Takeaway', icon: 'store', accent: true });
  if (order.paymentMethod) {
    chips.push({ label: order.paymentMethod, icon: /cash/i.test(order.paymentMethod) ? 'cash' : 'card' });
  }
  if (order.deliveryMode === 'priority') chips.push({ label: 'Priority', icon: 'zap', accent: true });
  if (order.deliveryMode === 'scheduled') {
    chips.push({
      label: order.scheduledFor ? `Scheduled · ${formatOrderTime(order.scheduledFor)}` : 'Scheduled',
      icon: 'calendar',
    });
  }
  if (order.requestUtensils) chips.push({ label: 'Utensils', icon: 'utensils' });
  return chips;
}

function BreakdownRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.breakdownRow}>
      <Text variant="microRegular" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="label" color={accent ? colors.success : colors.textStrong}>
        {value}
      </Text>
    </View>
  );
}

export function OrderCard({
  order,
  expanded,
  onToggle,
  meta,
  footer,
  etaAction,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  /** Trailing text in the meta row. Defaults to the item count. */
  meta?: string;
  /** The action row under the ETA (Active Orders). */
  footer?: ReactNode;
  /** Sits at the right end of the ETA row, e.g. "Cancel order". */
  etaAction?: ReactNode;
}) {
  const name = customerName(order);
  const address = order.address;
  const details = address
    ? [address.apt, address.buildingName, address.landmark].filter(Boolean).join(' · ')
    : '';
  const outcome =
    order.status === 'delivered'
      ? 'delivered'
      : order.status === 'cancelled' || order.status === 'refunded'
        ? 'failed'
        : null;
  const priority = order.deliveryMode === 'priority' && ACTIVE_STATUSES.includes(order.status);
  const chips = serviceChips(order);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}, ${displayRef(order.ref)}, ${statusLabel(order.status, order.orderType)}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <Text variant="h5" color={colors.onPrimary}>
            {initials(name, 1)}
          </Text>
        </View>
        <View style={styles.headText}>
          <View style={styles.nameRow}>
            <Text variant="h5" color={colors.textStrong} numberOfLines={1} style={styles.shrink}>
              {name}
            </Text>
            <StatusPill status={order.status} orderType={order.orderType} />
            {priority ? (
              <View style={[styles.pill, styles.priorityPill]}>
                <Text variant="captionBold" color={colors.primary} numberOfLines={1}>
                  ⚡ Priority
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Text variant="labelSm" color={colors.primary}>
              {displayRef(order.ref)}
            </Text>
            <Text variant="h3" color={colors.border} style={styles.dot}>
              ·
            </Text>
            <Text variant="microRegular" color={colors.textMuted} numberOfLines={1} style={styles.time}>
              {formatOrderTime(order.createdAt)}
            </Text>
            <Text variant="h3" color={colors.border} style={styles.dot}>
              ·
            </Text>
            <Text variant="microRegular" color={colors.textMuted} numberOfLines={1} style={styles.shrink}>
              {meta ?? itemCount(order)}
            </Text>
          </View>
        </View>
        <View style={expanded ? styles.chevronOpen : undefined}>
          <Icon name="chevronRight" size={16} color={colors.textMuted} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <OrderTracker order={order} />

          {chips.length ? (
            <View style={styles.chips}>
              {chips.map((chip) => (
                <View key={chip.label} style={[styles.chip, chip.accent && styles.chipAccent]}>
                  <Icon name={chip.icon} size={12} color={chip.accent ? colors.primary : colors.palette.gray700} />
                  <Text variant="labelSm" color={chip.accent ? colors.primary : colors.palette.gray700}>
                    {chip.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

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
                    <View style={styles.shrink}>
                      <Text variant="body" style={styles.regular} color={colors.palette.gray700} numberOfLines={1}>
                        {it.name}
                      </Text>
                      {it.selectedOptions?.length ? (
                        <Text variant="captionRegular" color={colors.textSecondary} numberOfLines={2}>
                          {it.selectedOptions.map((o) => o.label).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text variant="label" color={colors.textStrong}>
                    {formatMoney(it.lineTotal)}
                  </Text>
                </View>
              ))}
            </View>
            {/* What the customer was charged, broken down — so a discounted
                total is never a surprise to the kitchen. */}
            {order.pricing.promoDiscount > 0 || order.pricing.deliveryFee > 0 || order.pricing.priorityFee > 0 ? (
              <View style={styles.breakdown}>
                <BreakdownRow label="Items" value={formatMoney(order.pricing.subtotal)} />
                {order.pricing.promoDiscount > 0 ? (
                  <BreakdownRow
                    label={order.promoCode && /^[A-Z0-9]+$/.test(order.promoCode) ? `Promo ${order.promoCode}` : 'Offer'}
                    value={`-${formatMoney(order.pricing.promoDiscount)}`}
                    accent
                  />
                ) : null}
                {order.pricing.deliveryFee > 0 ? (
                  <BreakdownRow label="Delivery fee" value={formatMoney(order.pricing.deliveryFee)} />
                ) : null}
                {order.pricing.priorityFee > 0 ? (
                  <BreakdownRow label="Priority" value={formatMoney(order.pricing.priorityFee)} />
                ) : null}
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text variant="labelBold" color={colors.textSecondary}>
                Total
              </Text>
              <Text variant="price" color={colors.primary}>
                {formatMoney(order.pricing.total)}
              </Text>
            </View>
          </View>

          {order.noteToRestaurant ? (
            <View style={styles.inset}>
              <View style={[styles.banner, styles.noteBanner]}>
                <View style={styles.noteIcon}>
                  <Icon name="note" size={14} color={colors.palette.amber600} />
                </View>
                <Text variant="microRegular" color={colors.palette.amber800} style={styles.flex}>
                  <Text variant="micro" style={styles.bold} color={colors.palette.amber800}>
                    Note:{' '}
                  </Text>
                  {order.noteToRestaurant}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoRows}>
            {/* Where it goes — snapshotted onto the order at checkout; the
                restaurant cannot read the customer's address book. */}
            {address ? (
              <View style={styles.infoRow}>
                <Icon name="mapPinSm" size={13} color={colors.textMuted} />
                <Text variant="microRegular" color={colors.textSecondary} style={styles.flex}>
                  {address.label}:{' '}
                  <Text variant="labelSm" color={colors.palette.gray700}>
                    {addressLine(address)}
                  </Text>
                  {details ? ` · ${details}` : ''}
                  {order.deliveryDistanceKm != null ? ` · ${Math.round(order.deliveryDistanceKm * 10) / 10} km away` : ''}
                  {address.instructions ? ` · “${address.instructions}”` : ''}
                </Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Icon name="clockSm" size={13} color={colors.textMuted} />
              <Text variant="microRegular" color={colors.textSecondary} style={styles.flex}>
                {order.deliveryMode === 'scheduled' && order.scheduledFor
                  ? 'Scheduled for: '
                  : order.orderType === 'pickup'
                    ? 'Est. ready: '
                    : 'Est. delivery: '}
                <Text variant="labelSm" color={colors.palette.gray700}>
                  {order.deliveryMode === 'scheduled' && order.scheduledFor
                    ? formatOrderTime(order.scheduledFor)
                    : formatClockWindow(order.etaFrom, order.etaTo)}
                </Text>
              </Text>
              {etaAction ?? null}
            </View>
          </View>

          {outcome ? (
            <View style={styles.outcomeInset}>
              <View style={[styles.banner, outcome === 'delivered' ? styles.okBanner : styles.failBanner]}>
                <Icon
                  name={outcome === 'delivered' ? 'checkSm' : 'cross'}
                  size={14}
                  color={outcome === 'delivered' ? colors.palette.green600 : colors.primary}
                />
                <Text
                  variant="label"
                  color={outcome === 'delivered' ? colors.palette.green700 : colors.primary}
                  style={styles.flex}
                >
                  {outcome === 'delivered'
                    ? order.orderType === 'pickup'
                      ? 'Collected by the customer'
                      : 'Order delivered successfully'
                    : order.status === 'refunded'
                      ? 'Order refunded'
                      : cancelSummary(order)}
                </Text>
              </View>
            </View>
          ) : null}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  breakdown: { gap: spacing[1], paddingTop: spacing[3] },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    overflow: 'hidden',
    ...shadows.listCard,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
  },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  pill: {
    flexShrink: 0,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    height: 26,
    paddingTop: spacing[0.5],
  },
  dot: { fontFamily: fontFamily[400] },
  time: { flexShrink: 0 },
  priorityPill: { backgroundColor: colors.primaryTint },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2.5],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipAccent: { backgroundColor: colors.primaryTint },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  shrink: { flexShrink: 1, minWidth: 0 },
  flex: { flex: 1 },
  bold: { fontFamily: fontFamily[700] },
  regular: { fontFamily: fontFamily[400] },

  body: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    paddingTop: 9,
    paddingBottom: spacing[5],
    gap: spacing[2],
  },
  tracker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  stop: { alignItems: 'center', gap: spacing[2.5] },
  stopCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    flex: 1,
    height: 3,
    marginHorizontal: spacing[1.5],
    // Level with the circles, not the labels under them (15 label + 6 gap − 3).
    marginBottom: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },

  items: { paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[1.5] },
  itemList: { gap: spacing[3], paddingTop: spacing[3] },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexShrink: 1 },
  qty: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    borderRadius: radius.tag,
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

  inset: { paddingHorizontal: spacing[6], paddingTop: spacing[1.5] },
  outcomeInset: { paddingHorizontal: spacing[6] },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
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
  noteIcon: { paddingTop: spacing[0.5] },
  okBanner: { backgroundColor: colors.palette.green25, borderColor: colors.palette.green200 },
  failBanner: { backgroundColor: colors.palette.red100, borderColor: colors.palette.red300 },

  infoRows: { paddingHorizontal: spacing[6], paddingVertical: spacing[4], gap: spacing[3] },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },

  footer: { flexDirection: 'row', gap: spacing[3.5], paddingHorizontal: spacing[6] },
});
