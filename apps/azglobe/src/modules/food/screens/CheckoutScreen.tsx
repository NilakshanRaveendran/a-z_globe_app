import { useRef, useState, type ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BottomBar, Button, Card, Icon, Screen, ScreenHeader, Text } from '@core/ui';
import { MapPreview } from '../components/MapPreview';
import { AddressSearchSheet } from '../components/AddressSearchSheet';
import { PayWithSheet, PAYMENT_METHODS } from '../components/PayWithSheet';
import { NoteSheet } from '../components/NoteSheet';
import { formatScheduled, ScheduleSheet, scheduleDays } from '../components/ScheduleSheet';
import { useAddresses } from '../hooks/useAddresses';
import { addressSubtitle, addressTitle } from '../services/addresses';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { deliveryWindow, isRestaurantClosedError, newOrderId, pickupWindow, placeOrder } from '../services/orders';
import { getMerchant } from '../services/merchants';
import { FulfilmentToggle } from '../components/FulfilmentToggle';
import { useCart } from '../store/cart';
import { formatKm, quoteDelivery, type DeliveryQuote } from '../services/deliveryPricing';
import { DeliveryAreaNotice } from '../components/DeliveryAreaNotice';
import { useActiveOrder } from '../store/activeOrder';
import { useSession } from '@app/providers/SessionProvider';
import { foodKeys } from '../hooks/queries';
import { useCartPricing, type PricedGroup } from '../hooks/useCartPricing';
import type { DeliveryMode, Merchant } from '../types';
import type { FoodStackParamList } from '../navigation/types';
import { activeOffersKey } from '../hooks/useAppliedPromotion';
import { promoSaving, usePromoCodeHint } from '../hooks/usePromoCodeHint';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

const PRIORITY_FEE = 150;

/** What a closed restaurant — or the rules refusing the order — tells the customer. */
const CLOSED_MESSAGE = "This restaurant isn't taking orders right now.";
const OFFER_GONE_MESSAGE =
  'That offer is no longer available, so your total has been updated. Check it and place the order again.';
const RETRY_MESSAGE = 'We could not place your order just now. Please try again.';

const DROPOFF_LABEL: Record<string, string> = {
  door: 'Meet at my door',
  lobby: 'Leave at lobby',
  gate: 'Leave at gate',
};

/**
 * Checkout — Figma 414:3339, for a cart that may hold several restaurants.
 *
 *   address      map card + drop-off, when any restaurant delivers
 *   restaurants  one card each: its dishes, its own Delivery / Takeaway
 *                switch, fee (by distance where it prices that way) and offer
 *   time         Priority (+Rs. 150 per delivery) / Standard / Schedule —
 *                Schedule only for a single restaurant, whose hours set the slots
 *   extras       utensils + one note, sent to every restaurant
 *   price        items · offers · delivery fees · priority · total
 *   payment      one method for everything
 *   footer       "Place Order" (or "Place 2 Orders")
 *
 * One tap places one order per restaurant — each prepares, delivers or hands
 * over its own food — paid together. Each order id is fixed when checkout
 * opens, so a retry never places one twice; if one restaurant refuses, the
 * others stay placed (and leave the cart) and the error names the one to fix.
 */
export function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useSession();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const setFulfilment = useCart((s) => s.setFulfilment);
  const promoCode = useCart((s) => s.promoCode);
  const queryClient = useQueryClient();
  const { addresses, selected: address, select } = useAddresses();
  const pricing = useCartPricing(address);
  const { groups } = pricing;
  const single = groups.length === 1 ? groups[0] : undefined;
  const suggested = usePromoCodeHint(single?.merchantId);

  // One id per restaurant per checkout, so a retry after a write that did
  // land returns that order instead of placing a second one.
  const orderIds = useRef<Record<string, string>>({});
  const idFor = (merchantId: string) => (orderIds.current[merchantId] ??= newOrderId());
  const [placed, setPlaced] = useState<string[]>([]);
  const [pickedMode, setMode] = useState<DeliveryMode>('standard');
  const [scheduledFor, setScheduledFor] = useState<number | undefined>(undefined);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [utensils, setUtensils] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setActiveOrderId = useActiveOrder((s) => s.setOrderId);
  const [payOpen, setPayOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [paymentId, setPaymentId] = useState(PAYMENT_METHODS[0]!.id);

  const deliveries = groups.filter((g) => g.fulfilment === 'delivery').length;
  const allPickup = deliveries === 0;
  // Priority is a delivery upgrade; Schedule follows one restaurant's hours.
  const mode: DeliveryMode =
    (pickedMode === 'priority' && allPickup) || (pickedMode === 'scheduled' && !single) ? 'standard' : pickedMode;
  const modeFor = (g: PricedGroup): DeliveryMode =>
    mode === 'priority' && g.fulfilment === 'pickup' ? 'standard' : mode;
  const priorityFee = mode === 'priority' ? PRIORITY_FEE * deliveries : 0;
  const total = pricing.total + priorityFee;
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const closed = pricing.closed[0];
  const blocked = groups.find((g) => g.needsAddress);
  const paymentLabel = PAYMENT_METHODS.find((m) => m.id === paymentId)?.label ?? PAYMENT_METHODS[0]!.label;

  /** Place one restaurant's order; resolves to its id, or throws a customer-facing message. */
  const placeGroup = async (g: PricedGroup): Promise<string> => {
    // Re-read the restaurant: it may have closed since the page opened, and its
    // fee is what the rules check the order against.
    const fresh: Merchant =
      (await queryClient
        .fetchQuery({ queryKey: foodKeys.merchant(g.merchantId), queryFn: () => getMerchant(g.merchantId), staleTime: 0 })
        .catch(() => null)) ?? g.merchant!;
    if (!fresh.isOpen) throw new Error(CLOSED_MESSAGE);
    const pickup = g.fulfilment === 'pickup';
    const priced = pickup ? null : quoteDelivery(fresh, address, g.subtotal);
    if (priced && !priced.ok) throw new Error(quoteProblem(priced, fresh.name));
    try {
      const order = await placeOrder({
        // The fee actually charged: by distance, or 0 inside the free zone or
        // once the free-delivery threshold is met.
        merchant: { ...fresh, deliveryFee: priced?.ok ? priced.fee : 0 },
        deliveryDistanceKm: priced?.ok ? priced.distanceKm : undefined,
        // The restaurant cannot look the customer up — see Order.userName.
        userName: user.fullName,
        orderType: g.fulfilment,
        address: pickup ? null : address,
        lines: g.lines,
        deliveryMode: modeFor(g),
        scheduledFor: mode === 'scheduled' ? scheduledFor : undefined,
        noteToRestaurant: note || undefined,
        requestUtensils: utensils,
        // The promotion's document id — a typed code, or the offer's id.
        promoCode: g.promotion.promo?.id,
        promoDiscount: g.promotion.discount,
        paymentMethod: paymentLabel,
        orderId: idFor(g.merchantId),
      });
      return order.id;
    } catch (e) {
      // Those messages are written for the customer, so show them rather than
      // a generic failure. The rules refuse a closed restaurant, but also an
      // offer that has ended, run out or no longer meets its minimum — both
      // arrive as the same permission error. Re-read to tell which it was.
      let message = messageFor(e);
      if (message === CLOSED_MESSAGE && !isRestaurantClosedError(e)) {
        const now = await getMerchant(g.merchantId).catch(() => null);
        if (now?.isOpen !== false) {
          if (g.promotion.promo) {
            message = OFFER_GONE_MESSAGE;
            void queryClient.invalidateQueries({ queryKey: activeOffersKey(g.merchantId) });
            void queryClient.invalidateQueries({ queryKey: ['promoCode'] });
          } else {
            message = RETRY_MESSAGE;
          }
        }
      }
      throw new Error(message);
    }
  };

  const onPlaceOrder = async () => {
    if (!groups.length || groups.some((g) => !g.merchant)) return;
    if (deliveries && !address) {
      setError('Add a delivery address to place your order.');
      return;
    }
    if (blocked?.quote && !blocked.quote.ok) {
      setError(quoteProblem(blocked.quote, blocked.merchantName));
      return;
    }
    if (
      mode === 'scheduled' &&
      single?.merchant &&
      !(scheduledFor && scheduleDays(single.merchant).some((d) => d.slots.includes(scheduledFor)))
    ) {
      setError('That time is no longer available — pick another.');
      setScheduleOpen(true);
      return;
    }
    setPlacing(true);
    setError(null);
    const done = [...placed];
    try {
      for (const g of groups) {
        try {
          const id = await placeGroup(g);
          done.push(id);
          // Tracked on Home at once — even if a later restaurant refuses.
          if (done.length === 1) setActiveOrderId(id);
          // Out of the cart as soon as it is placed, so a retry only re-sends the rest.
          clear([g.merchantId]);
        } catch (e) {
          const why = e instanceof Error ? e.message : RETRY_MESSAGE;
          setError(groups.length > 1 || done.length ? `${g.merchantName}: ${why}` : why);
          return;
        }
      }
      setActiveOrderId(done[0] ?? null);
      navigation.replace('OrderPlaced', { orderId: done[0]!, ...(done.length > 1 ? { orderIds: done } : {}) });
    } finally {
      setPlaced(done);
      setPlacing(false);
    }
  };

  const placeLabel = closed
    ? `${closed.merchantName} ${closed.missing ? 'is unavailable' : 'is closed'}`
    : groups.length > 1
      ? `Place ${groups.length} Orders`
      : allPickup
        ? 'Place Takeaway Order'
        : 'Place Order';

  return (
    <Screen>
      <ScreenHeader
        title="Checkout"
        subtitle={groups.length > 1 ? `${groups.length} restaurants · one payment` : undefined}
        onBack={navigation.goBack}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {placed.length ? (
          <View accessibilityRole="alert" style={styles.placedNote}>
            <Icon name="checkCircle" size={16} color={colors.success} />
            <Text variant="bodySm" color={colors.success} style={styles.flex}>
              {placed.length} order{placed.length === 1 ? ' is' : 's are'} already placed. Fix the one below and place it
              too.
            </Text>
          </View>
        ) : null}

        {deliveries ? (
          <Card padded={false} style={styles.mapCard}>
            <MapPreview
              label={address ? `${addressTitle(address)}, ${addressSubtitle(address)}` : 'No delivery address yet'}
              height={130}
            />
            <Pressable
              style={styles.row}
              onPress={() => (address ? setAddressOpen(true) : navigation.navigate('AddressInfo', { label: 'Home' }))}
            >
              <View style={styles.iconWell}>
                <Icon name="mapPin" size={16} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodySm" color={colors.textMuted}>
                  Deliver to
                </Text>
                <Text variant="h5" color={colors.textStrong}>
                  {address ? addressTitle(address) : 'Add a delivery address'}
                </Text>
                <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1}>
                  {address ? addressSubtitle(address) : 'Required to place your order'}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={colors.textMuted} />
            </Pressable>
            {address ? (
              <>
                <View style={styles.divider} />
                <Pressable style={styles.row} onPress={() => navigation.navigate('AddressInfo', { addressId: address.id })}>
                  <View style={styles.iconWellNeutral}>
                    <Icon name="person" size={16} color={colors.textSecondary} />
                  </View>
                  <Text variant="body" color={colors.textSecondary} style={styles.flex}>
                    {DROPOFF_LABEL[address.dropoffOption] ?? 'Meet at my door'}
                  </Text>
                  <Icon name="chevronRight" size={16} color={colors.textMuted} />
                </Pressable>
              </>
            ) : null}
          </Card>
        ) : null}

        {groups.map((g) => (
          <RestaurantCheckoutCard
            key={g.merchantId}
            group={g}
            onFulfilment={(f) => setFulfilment(g.merchantId, f)}
            onChangeAddress={() => setAddressOpen(true)}
            onPin={() => address && navigation.navigate('AddressInfo', { addressId: address.id, useLocation: true })}
            onAddAddress={() => navigation.navigate('AddressInfo', { label: 'Home' })}
          />
        ))}

        <Card style={styles.block}>
          <View style={styles.blockHead}>
            <View style={styles.iconWell}>
              <Icon name="clock" size={16} color={colors.primary} />
            </View>
            <Text variant="h4" color={colors.textStrong}>
              {allPickup ? 'Pickup time' : deliveries === groups.length ? 'Delivery time' : 'When'}
            </Text>
          </View>

          <View style={styles.modeRow}>
            {allPickup ? null : (
              <ModeOption
                title="Priority"
                badge={<Icon name="zap" size={14} color={colors.palette.amber500} />}
                subtitle={
                  single?.merchant ? windowLabel(deliveryWindow(single.merchant, 'priority')) : 'Faster delivery'
                }
                extra={`+${formatMoney(PRIORITY_FEE)}${deliveries > 1 ? ' each' : ''}`}
                selected={mode === 'priority'}
                onPress={() => setMode('priority')}
              />
            )}
            <ModeOption
              title={allPickup ? 'ASAP' : 'Standard'}
              subtitle={
                single?.merchant
                  ? allPickup
                    ? `Ready in ${windowLabel(pickupWindow(single.merchant))}`
                    : windowLabel(deliveryWindow(single.merchant, 'standard'))
                  : 'As soon as ready'
              }
              selected={mode === 'standard'}
              onPress={() => setMode('standard')}
            />
            {single ? (
              <ModeOption
                title="Schedule"
                // Day and time on their own lines, so a narrow tile never splits "1:00 PM".
                subtitle={mode === 'scheduled' && scheduledFor ? formatScheduled(scheduledFor).replace(', ', '\n') : 'Choose time'}
                selected={mode === 'scheduled'}
                // The mode only changes once a time is confirmed in the sheet.
                onPress={() => single.merchant && setScheduleOpen(true)}
              />
            ) : null}
          </View>
        </Card>

        <Card padded={false} style={styles.block}>
          {/* Figma draws a 22pt checkbox here, not a switch. */}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: utensils }}
            onPress={() => setUtensils((v) => !v)}
            style={styles.row}
          >
            <View style={styles.iconWellNeutral}>
              <Icon name="utensils" size={16} color={colors.textSecondary} />
            </View>
            <Text variant="body" color={colors.text} style={styles.flex}>
              Request utensils, etc.
            </Text>
            <View style={[styles.checkbox, utensils && styles.checkboxOn]}>
              {utensils ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}
            </View>
          </Pressable>
          <View style={styles.divider} />
          <Pressable accessibilityRole="button" style={styles.row} onPress={() => setNoteOpen(true)}>
            <View style={styles.iconWellNeutral}>
              <Icon name="pencil" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <Text variant="body" color={colors.text}>
                {note ? 'Note' : groups.length > 1 ? 'Add note for the restaurants' : 'Add note to restaurant'}
              </Text>
              {note ? (
                <Text variant="bodySm" color={colors.textSecondary} numberOfLines={2}>
                  {note}
                </Text>
              ) : null}
            </View>
            <Icon name="chevronRight" size={16} color={colors.textMuted} />
          </Pressable>
        </Card>

        <Card style={styles.block}>
          <Text variant="h4" color={colors.textHeading}>
            Price details
          </Text>
          <PriceRow label={`Items (${itemCount})`} value={formatMoney(pricing.subtotal)} />
          {pricing.discount > 0 ? (
            <PriceRow label="Offers & promos" value={`-${formatMoney(pricing.discount)}`} accent />
          ) : null}
          {deliveries ? (
            <PriceRow
              label={deliveries > 1 ? `Delivery fees (${deliveries})` : 'Delivery fee'}
              value={blocked ? '—' : pricing.deliveryFees === 0 ? 'Free' : formatMoney(pricing.deliveryFees)}
              accent={!blocked && pricing.deliveryFees === 0}
            />
          ) : (
            <PriceRow label="Takeaway" value="No delivery fee" accent />
          )}
          {priorityFee > 0 ? (
            <PriceRow label={deliveries > 1 ? `Priority (${deliveries})` : 'Priority fee'} value={formatMoney(priorityFee)} />
          ) : null}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text variant="h3" color={colors.textHeading}>
              Total
            </Text>
            <Text variant="h3" color={colors.primary}>
              {formatMoney(total)}
            </Text>
          </View>
          {groups.length > 1 ? (
            <View style={styles.split}>
              {groups.map((g) => (
                <View key={g.merchantId} style={styles.priceRow}>
                  <Text variant="bodySm" color={colors.textSecondary} style={styles.flex} numberOfLines={1}>
                    {g.merchantName} · {g.fulfilment === 'pickup' ? 'Takeaway' : 'Delivery'}
                  </Text>
                  <Text variant="bodySm" color={colors.textStrong}>
                    {formatMoney(g.total + (modeFor(g) === 'priority' ? PRIORITY_FEE : 0))}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Card padded={false} style={styles.block}>
          <Pressable style={styles.row} onPress={() => setPayOpen(true)}>
            <View style={paymentId === 'cod' ? styles.cod : styles.visa}>
              {paymentId === 'cod' ? (
                <Icon name="cash" size={20} color="#16A34A" />
              ) : (
                <Text variant="labelSm" color={colors.onPrimary}>
                  VISA
                </Text>
              )}
            </View>
            <View style={styles.flex}>
              <Text variant="bodySm" color={colors.textMuted}>
                {groups.length > 1 ? 'Pay for all orders with' : 'Payment method'}
              </Text>
              <Text variant="bodyLg" color={colors.textStrong}>
                {paymentLabel}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.textMuted} />
          </Pressable>
        </Card>

        {suggested?.code && !promoCode && !single?.promotion.promo ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Cart')}
            style={({ pressed }) => [styles.promoHint, pressed && styles.pressed]}
          >
            <Icon name="offers" size={15} color={colors.primary} />
            <Text variant="bodySm" color={colors.primary} style={styles.flex}>
              Use promo code {suggested.code} in your cart to save {promoSaving(suggested)}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomBar>
        {error ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <Icon name="warning" size={16} color={colors.primary} />
            <Text variant="bodySm" color={colors.primary} style={styles.flex}>
              {error}
            </Text>
          </View>
        ) : null}
        <Button
          label={placeLabel}
          onPress={onPlaceOrder}
          loading={placing}
          disabled={!lines.length || pricing.loading || !!blocked || !!closed}
        />
      </BottomBar>

      {single?.merchant ? (
        <ScheduleSheet
          visible={scheduleOpen}
          merchant={single.merchant}
          value={scheduledFor}
          onConfirm={(at) => {
            setScheduledFor(at);
            setMode('scheduled');
            setError(null);
          }}
          onClose={() => setScheduleOpen(false)}
        />
      ) : null}

      <NoteSheet visible={noteOpen} value={note} onSave={setNote} onClose={() => setNoteOpen(false)} />

      <PayWithSheet
        visible={payOpen}
        selectedId={paymentId}
        onSelect={setPaymentId}
        onClose={() => setPayOpen(false)}
      />

      <AddressSearchSheet
        visible={addressOpen}
        addresses={addresses}
        selectedId={address?.id}
        onSelect={(next) => {
          select(next.id);
          setAddressOpen(false);
        }}
        onEdit={(next) => {
          setAddressOpen(false);
          navigation.navigate('AddressInfo', { addressId: next.id });
        }}
        onAdd={(intent) => {
          setAddressOpen(false);
          navigation.navigate('AddressInfo', intent);
        }}
        onClose={() => setAddressOpen(false)}
      />
    </Screen>
  );
}

/** One restaurant's order at checkout: what's in it, how it arrives, what it costs. */
function RestaurantCheckoutCard({
  group,
  onFulfilment,
  onChangeAddress,
  onPin,
  onAddAddress,
}: {
  group: PricedGroup;
  onFulfilment: (f: 'delivery' | 'pickup') => void;
  onChangeAddress: () => void;
  onPin: () => void;
  onAddAddress: () => void;
}) {
  const { merchant, quote } = group;
  const pickup = group.fulfilment === 'pickup';
  return (
    <Card style={styles.block}>
      <View style={styles.blockHead}>
        <View style={styles.iconWell}>
          <Icon name="store" size={16} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="h4" color={colors.textStrong} numberOfLines={1}>
            {group.merchantName}
          </Text>
          <Text variant="bodySm" color={colors.textSecondary}>
            {group.itemCount} item{group.itemCount === 1 ? '' : 's'} · {formatMoney(group.subtotal)}
          </Text>
        </View>
      </View>

      {group.closed || group.missing ? (
        <View accessibilityRole="alert" style={styles.notice}>
          <Icon name="clock" size={16} color={colors.primary} />
          <Text variant="bodySm" color={colors.primary} style={styles.flex}>
            {group.merchantName} {group.missing ? "isn't available right now" : "is closed right now and isn't taking orders"}.
            Remove its dishes in your cart to order the rest.
          </Text>
        </View>
      ) : null}

      <View style={styles.summaryBody}>
        {group.lines.map((l) => (
          <View key={l.lineId} style={styles.summaryLine}>
            <Text variant="bodyLg" color={colors.textSecondary} style={styles.flex} numberOfLines={1}>
              ×{l.qty}  {l.name}
            </Text>
            <Text variant="bodyLg" color={colors.textStrong}>
              {formatMoney(l.unitPrice * l.qty)}
            </Text>
          </View>
        ))}
      </View>

      <FulfilmentToggle compact merchant={merchant} quote={quote} value={group.fulfilment} onChange={onFulfilment} />
      {quote && !quote.ok && (!pickup || quote.reason === 'outOfRange') ? (
        <DeliveryAreaNotice
          quote={quote}
          merchantName={group.merchantName}
          onChangeAddress={onChangeAddress}
          onPin={onPin}
          onAddAddress={onAddAddress}
        />
      ) : null}

      <View style={styles.priceRow}>
        <Text variant="bodySm" color={colors.textMuted} style={styles.flex} numberOfLines={2}>
          {pickup
            ? `Pick up from ${merchant?.address || group.merchantName}`
            : quote?.ok && quote.distanceKm != null
              ? `Delivery · ${formatKm(quote.distanceKm)} km away`
              : 'Delivery'}
        </Text>
        <Text variant="bodySm" color={pickup || group.deliveryFee === 0 ? colors.success : colors.textStrong}>
          {pickup ? 'No fee' : group.needsAddress ? '—' : group.deliveryFee === 0 ? 'Free' : formatMoney(group.deliveryFee)}
        </Text>
      </View>
      {group.promotion.discount > 0 ? (
        <View style={styles.offerRow}>
          <Icon name="offers" size={14} color={colors.success} />
          <Text variant="bodySm" color={colors.success} style={styles.flex}>
            {group.promotion.automatic ? group.promotion.label : `Promo ${group.promotion.label}`} — you save{' '}
            {formatMoney(group.promotion.discount)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** Why delivery can't be placed to this address, for the error banner. */
function quoteProblem(quote: Extract<DeliveryQuote, { ok: false }>, merchantName: string): string {
  if (quote.reason === 'outOfRange') {
    return `${merchantName} only delivers within ${formatKm(quote.maxKm ?? 0)} km. Choose takeaway or a closer address.`;
  }
  if (quote.reason === 'needsPin') return 'Pin your delivery address on the map so the delivery fee can be worked out.';
  return 'Add a delivery address to place your order.';
}

/**
 * What to tell the customer when an order is refused.
 *
 * Orders are written straight to Firestore, whose rules refuse one for a
 * restaurant that is closed (or a fee or promo that no longer holds) with a raw
 * "Missing or insufficient permissions." — never shown as such. The order
 * service's own RestaurantClosedError reads the same. Other customer-facing
 * messages (a Cloud Function's HttpsError) are shown as written; anything else
 * gets a plain fallback.
 */
function messageFor(e: unknown): string {
  const err = (typeof e === 'object' && e ? e : {}) as { code?: unknown; message?: unknown };
  const code = String(err.code ?? '');
  const message = String(err.message ?? '');
  if (
    isRestaurantClosedError(e) ||
    code === 'permission-denied' ||
    /insufficient permissions/i.test(message)
  ) {
    return CLOSED_MESSAGE;
  }
  if (!message || /internal|not-found|deadline|unavailable|network/i.test(`${code} ${message}`)) {
    return RETRY_MESSAGE;
  }
  return message;
}

function ModeOption({
  title,
  badge,
  subtitle,
  extra,
  selected,
  onPress,
}: {
  title: string;
  /** Drawn after the title — Priority's amber lightning. */
  badge?: ReactNode;
  subtitle: string;
  extra?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.mode, selected ? styles.modeSelected : styles.modeUnselected]}
    >
      <View style={styles.modeTitle}>
        <Text variant="label" color={selected ? colors.primary : colors.textStrong}>
          {title}
        </Text>
        {badge}
      </View>
      <Text variant="microRegular" color={selected ? colors.primary : colors.textSecondary}>
        {subtitle}
      </Text>
      {extra ? (
        <Text variant="micro" color={colors.primary}>
          {extra}
        </Text>
      ) : null}
    </Pressable>
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
  content: { padding: SCREEN_PADDING, gap: spacing[4], paddingBottom: spacing[8] },
  flex: { flex: 1 },

  mapCard: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], padding: spacing[5] },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing[5] },
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

  block: { gap: spacing[3] },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  modeRow: { flexDirection: 'row', gap: spacing[3], paddingTop: spacing[2] },
  mode: {
    flex: 1,
    gap: spacing[1],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  modeSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  modeUnselected: { backgroundColor: colors.surface, borderColor: colors.border },

  modeTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  chevronDown: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },
  pressed: { opacity: 0.8 },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.53,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
  },
  summaryBody: { gap: spacing[2] },
  split: { gap: spacing[2], paddingTop: spacing[2] },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  placedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.palette.green25,
  },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },

  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  visa: {
    width: 48,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1F71',
  },
  cod: {
    width: 48,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
  },
  promoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
  },
});

function windowLabel({ min, max }: { min: number; max: number }) {
  return `${min}–${max} min`;
}
