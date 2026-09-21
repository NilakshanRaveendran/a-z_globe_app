import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { BottomBar, Button, Card, Icon, Screen, ScreenHeader, Text } from '@core/ui';
import { MapPreview } from '../components/MapPreview';
import { AddressSearchSheet } from '../components/AddressSearchSheet';
import { PayWithSheet, PAYMENT_METHODS } from '../components/PayWithSheet';
import { useAddresses } from '../hooks/useAddresses';
import { addressSubtitle, addressTitle } from '../services/addresses';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { deliveryWindow, placeOrder } from '../services/orders';
import { useCart } from '../store/cart';
import { useActiveOrder } from '../store/activeOrder';
import { useSession } from '@app/providers/SessionProvider';
import { useMerchant } from '../hooks/queries';
import type { DeliveryMode } from '../types';
import type { FoodStackParamList } from '../navigation/types';
import { useAppliedPromotion } from '../hooks/useAppliedPromotion';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

const PRIORITY_FEE = 150;

const DROPOFF_LABEL: Record<string, string> = {
  door: 'Meet at my door',
  lobby: 'Leave at lobby',
  gate: 'Leave at gate',
};

/**
 * Checkout — Figma 414:3339.
 *
 *   map card     address + dropoff rows
 *   delivery     Priority (+Rs. 150) / Standard / Schedule, selected = #FFF1F1
 *                with a #D42B2B border
 *   summary      collapsible "1 item · Rs. 550"
 *   extras       "Request utensils, etc." toggle + "Add note to restaurant"
 *   price        Subtotal / Delivery fee / Total (Total in #D42B2B)
 *   payment      card row
 *   footer       "Place Order"
 */
export function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useSession();
  const { lines, merchantId, clear } = useCart();
  const applied = useAppliedPromotion();
  const promoDiscount = applied.discount;
  const subtotal = useCart((s) => s.subtotal());
  const { data: merchant } = useMerchant(merchantId ?? '');

  const [mode, setMode] = useState<DeliveryMode>('standard');
  const [utensils, setUtensils] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setActiveOrderId = useActiveOrder((s) => s.setOrderId);
  const [payOpen, setPayOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [paymentId, setPaymentId] = useState(PAYMENT_METHODS[0]!.id);
  // The real address book. Checkout never invents a destination: with no saved
  // address the order cannot be placed until the customer adds one.
  const { addresses, selected: address, select } = useAddresses();

  const deliveryFee = merchant?.deliveryFee ?? 0;
  const priorityFee = mode === 'priority' ? PRIORITY_FEE : 0;
  const total = Math.max(0, subtotal - promoDiscount) + deliveryFee + priorityFee;
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  const onPlaceOrder = async () => {
    if (!merchant) return;
    if (!address) {
      setError('Add a delivery address to place your order.');
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const order = await placeOrder({
        merchant,
        // The restaurant cannot look the customer up — see Order.userName.
        userName: user.fullName,
        address,
        lines,
        deliveryMode: mode,
        requestUtensils: utensils,
        // The promotion's document id — a typed code, or the offer's id.
        promoCode: applied.promo?.id,
        promoDiscount,
      });
      clear();
      setActiveOrderId(order.id);
      navigation.replace('OrderPlaced', { orderId: order.id });
    } catch (e) {
      // placeOrder is a Cloud Function: it rejects when the restaurant has
      // closed, a dish sold out, the promo is invalid, or the user is signed
      // out. Those messages are written for the customer, so show them rather
      // than a generic failure — and never leave the button spinning silently.
      setError(messageFor(e));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Checkout" onBack={navigation.goBack} backStyle="circle" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card padded={false} style={styles.mapCard}>
          <MapPreview
            label={address ? `${addressTitle(address)}, ${addressSubtitle(address)}` : 'No delivery address yet'}
            height={150}
          />
          <Pressable
            style={styles.row}
            onPress={() =>
              address ? setAddressOpen(true) : navigation.navigate('AddressInfo', { label: 'Home' })
            }
          >
            <View style={styles.iconWell}>
              <Icon name="mapPin" size={16} color={colors.primary} />
            </View>
            <View style={styles.flex}>
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
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('AddressInfo', { addressId: address.id })}
              >
                <View style={styles.iconWellNeutral}>
                  <Icon name="mapPin" size={16} color={colors.textSecondary} />
                </View>
                <Text variant="bodyLg" color={colors.textMuted} style={styles.flex}>
                  {DROPOFF_LABEL[address.dropoffOption] ?? 'Meet at my door'}
                </Text>
                <Icon name="chevronRight" size={16} color={colors.textMuted} />
              </Pressable>
            </>
          ) : null}
        </Card>

        <Card style={styles.block}>
          <View style={styles.blockHead}>
            <View style={styles.iconWell}>
              <Icon name="clock" size={16} color={colors.primary} />
            </View>
            <Text variant="h4" color={colors.textStrong}>
              Delivery time
            </Text>
          </View>

          <View style={styles.modeRow}>
            <ModeOption
              title="Priority ⚡"
              subtitle={merchant ? windowLabel(deliveryWindow(merchant, 'priority')) : ''}
              extra={`+${formatMoney(PRIORITY_FEE)}`}
              selected={mode === 'priority'}
              onPress={() => setMode('priority')}
            />
            <ModeOption
              title="Standard"
              subtitle={merchant ? windowLabel(deliveryWindow(merchant, 'standard')) : ''}
              selected={mode === 'standard'}
              onPress={() => setMode('standard')}
            />
            <ModeOption
              title="Schedule"
              subtitle="Choose time"
              selected={mode === 'scheduled'}
              onPress={() => setMode('scheduled')}
            />
          </View>
        </Card>

        <Card padded={false} style={styles.block}>
          <Pressable style={styles.row} onPress={() => setSummaryOpen((v) => !v)}>
            <View style={styles.iconWellNeutral}>
              <Icon name="orderSummary" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <Text variant="h4" color={colors.textStrong}>
                Order summary
              </Text>
              <Text variant="bodySm" color={colors.textSecondary}>
                {itemCount} item{itemCount === 1 ? '' : 's'} · {formatMoney(subtotal)}
              </Text>
            </View>
            <View style={summaryOpen ? styles.chevronOpen : undefined}>
              <Icon name="chevronRight" size={16} color={colors.textMuted} />
            </View>
          </Pressable>

          {summaryOpen ? (
            <View style={styles.summaryBody}>
              {lines.map((l) => (
                <View key={l.lineId} style={styles.summaryLine}>
                  <Text variant="bodyLg" color={colors.textSecondary} style={styles.flex}>
                    ×{l.qty}  {l.name}
                  </Text>
                  <Text variant="bodyLg" color={colors.textStrong}>
                    {formatMoney(l.unitPrice * l.qty)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Card padded={false} style={styles.block}>
          <View style={styles.row}>
            <View style={styles.iconWellNeutral}>
              <Icon name="utensils" size={16} color={colors.textSecondary} />
            </View>
            <Text variant="bodyLg" color={colors.textStrong} style={styles.flex}>
              Request utensils, etc.
            </Text>
            <Switch
              value={utensils}
              onValueChange={setUtensils}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <View style={styles.iconWellNeutral}>
              <Icon name="pencil" size={16} color={colors.textSecondary} />
            </View>
            <Text variant="bodyLg" color={colors.textStrong} style={styles.flex}>
              Add note to restaurant
            </Text>
            <Icon name="chevronRight" size={16} color={colors.textMuted} />
          </Pressable>
        </Card>

        <Card style={styles.block}>
          <Text variant="h4" color={colors.textHeading}>
            Price details
          </Text>
          <PriceRow label="Subtotal" value={formatMoney(subtotal)} />
          {promoDiscount > 0 ? (
            <PriceRow
              label={applied.automatic ? `Offer (${applied.label})` : `Promo (${applied.label})`}
              value={`-${formatMoney(promoDiscount)}`}
              accent
            />
          ) : null}
          <PriceRow label="Delivery fee" value={formatMoney(deliveryFee)} />
          {priorityFee > 0 ? <PriceRow label="Priority fee" value={formatMoney(priorityFee)} /> : null}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text variant="h3" color={colors.textHeading}>
              Total
            </Text>
            <Text variant="h3" color={colors.primary}>
              {formatMoney(total)}
            </Text>
          </View>
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
                Payment method
              </Text>
              <Text variant="bodyLg" color={colors.textStrong}>
                {PAYMENT_METHODS.find((m) => m.id === paymentId)?.label}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.textMuted} />
          </Pressable>
        </Card>

      </ScrollView>

      <BottomBar>
        {error ? (
          <View style={styles.errorBanner}>
            <Icon name="zap" size={16} color={colors.primary} />
            <Text variant="bodySm" color={colors.primary} style={styles.flex}>
              {error}
            </Text>
          </View>
        ) : null}
        <Button
          label="Place Order"
          onPress={onPlaceOrder}
          loading={placing}
          disabled={!lines.length || !merchant || !address}
        />
      </BottomBar>

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

/**
 * Cloud Functions surface a customer-facing `message` on HttpsError; anything
 * else (no network, function not deployed) gets a plain fallback.
 */
function messageFor(e: unknown): string {
  const message = typeof e === 'object' && e && 'message' in e ? String(e.message) : '';
  if (!message || /internal|not-found|deadline/i.test(message)) {
    return 'We could not place your order just now. Please try again.';
  }
  return message;
}

function ModeOption({
  title,
  subtitle,
  extra,
  selected,
  onPress,
}: {
  title: string;
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
      <Text variant="label" color={selected ? colors.primary : colors.textStrong}>
        {title}
      </Text>
      <Text variant="micro" color={selected ? colors.primary : colors.textSecondary}>
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

  chevronOpen: { transform: [{ rotate: '90deg' }] },
  summaryBody: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], gap: spacing[2] },
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
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
  },
});

function windowLabel({ min, max }: { min: number; max: number }) {
  return `${min}–${max} min`;
}
