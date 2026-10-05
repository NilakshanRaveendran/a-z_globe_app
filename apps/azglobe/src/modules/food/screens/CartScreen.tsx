import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { BottomBar, Button, Card, Icon, QuantityStepper, Screen, ScreenHeader, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing, typography } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import { discountFor, discountLabel, findPromoCode, ineligibleReason, lineDiscount } from '../services/promotions';
import { useAddresses } from '../hooks/useAddresses';
import { useCartPricing, type PricedGroup } from '../hooks/useCartPricing';
import { addressSubtitle, addressTitle } from '../services/addresses';
import { AddressSearchSheet } from '../components/AddressSearchSheet';
import { FulfilmentToggle } from '../components/FulfilmentToggle';
import { DeliveryAreaNotice } from '../components/DeliveryAreaNotice';
import { useCart } from '../store/cart';
import { promoSaving, usePromoCodeHint } from '../hooks/usePromoCodeHint';
import type { FoodStackParamList } from '../navigation/types';
import type { CartLine, Promotion } from '../types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * Your Cart — Figma 414:2985, extended to hold dishes from several
 * restaurants at once.
 *
 *   header       "Your Cart" + the restaurant (or "2 restaurants · one payment")
 *   restaurant   one card per restaurant: name and item count, its dishes
 *                (thumb 56 · name · option chips · price · stepper · trash),
 *                its own Delivery / Takeaway switch and any offer it applies
 *   promo card   one input — a code is applied to the restaurant it is for
 *   address      where the delivering restaurants deliver to (hidden when
 *                every restaurant is takeaway)
 *   summary      items · discounts · delivery fees · total
 *   footer       red total strip + "Go to Checkout"
 *
 * Each restaurant becomes its own order at checkout — it prepares, delivers
 * or hands over its own food — and all of them are paid together.
 */
export function CartScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <CartContent
      onBack={navigation.goBack}
      onBrowse={() => navigation.navigate('FoodLanding')}
      onCheckout={() => navigation.navigate('Checkout')}
      onAddress={(params) => navigation.navigate('AddressInfo', params)}
    />
  );
}

/** Shared cart state and layout; each navigator owns its outgoing routes. */
export function CartContent({ onBack, onBrowse, onCheckout, onAddress, inTab = false }: {
  onBack?: () => void;
  onBrowse: () => void;
  onCheckout: () => void;
  onAddress: (params: FoodStackParamList['AddressInfo']) => void;
  inTab?: boolean;
}) {
  const { lines, promoCode, promoMerchantId, applyPromo, clearPromo, setFulfilment } = useCart();
  const { addresses, selected: address, select } = useAddresses();
  const pricing = useCartPricing(address);
  const { groups } = pricing;
  const [expandedRestaurant, setExpandedRestaurant] = useState<string | null | undefined>(undefined);
  const expandedId = expandedRestaurant === undefined || (expandedRestaurant !== null && !groups.some(g => g.merchantId === expandedRestaurant))
    ? (groups.length === 1 ? groups[0]?.merchantId : null)
    : expandedRestaurant;
  const [code, setCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const single = groups.length === 1 ? groups[0] : undefined;
  const suggested = usePromoCodeHint(single?.merchantId);
  const promoGroup = groups.find((g) => g.merchantId === promoMerchantId);

  // A code belongs to one restaurant's order: the one it names, or — for a
  // code any restaurant accepts — the one in the cart it saves most on.
  const onApply = async () => {
    setApplying(true);
    try {
      const promo = await findPromoCode(code);
      if (!promo) {
        setPromoError('That promo code is not valid.');
        return;
      }
      const candidates = groups
        .filter((g) => !promo.merchantId || g.merchantId === promo.merchantId)
        .map((g) => ({ g, reason: ineligibleReason(promo, g.merchantId, g.subtotal) }));
      const eligible = candidates
        .filter((c) => !c.reason)
        .sort((a, b) => discountFor(promo, b.g.lines, b.g.subtotal) - discountFor(promo, a.g.lines, a.g.subtotal));
      const target = eligible[0]?.g;
      if (!target) {
        setPromoError(
          candidates[0]?.reason ?? 'That code is for a restaurant that isn’t in your cart.'
        );
        return;
      }
      setPromoError(null);
      setCode('');
      applyPromo(code, target.merchantId);
    } finally {
      setApplying(false);
    }
  };

  if (!lines.length) {
    return (
      <Screen>
        <ScreenHeader title="Your Cart" onBack={onBack} />
        <View style={styles.empty}>
          <Icon name="cart" size={40} color={colors.textMuted} />
          <Text variant="h3" color={colors.textStrong} align="center">
            Your cart is empty
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary} align="center">
            Add a dish and it will show up here.
          </Text>
          <Button label="Browse restaurants" onPress={onBrowse} fullWidth={false} style={styles.emptyCta} />
        </View>
      </Screen>
    );
  }

  const closed = pricing.closed[0];
  const deliveries = groups.filter((g) => g.fulfilment === 'delivery').length;

  return (
    <Screen>
      <ScreenHeader
        title="Your Cart"
        subtitle={single ? single.merchantName : `${groups.length} restaurants · one payment`}
        onBack={onBack}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {groups.map((g) => (
          <RestaurantCard
            key={g.merchantId}
            group={g}
            expanded={expandedId === g.merchantId}
            onToggle={() => setExpandedRestaurant(expandedId === g.merchantId ? null : g.merchantId)}
            onFulfilment={(f) => setFulfilment(g.merchantId, f)}
            onChangeAddress={() => setAddressOpen(true)}
            onPin={() => address && onAddress({ addressId: address.id, useLocation: true })}
            onAddAddress={() => onAddress({ label: 'Home' })}
          />
        ))}

        <Card style={styles.block}>
          <Text variant="h4" color={colors.textHeading}>
            Promo Code
          </Text>
          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Enter promo code"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setPromoError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Button
              label="Apply"
              size="md"
              onPress={() => void onApply()}
              loading={applying}
              disabled={!code.trim()}
              fullWidth={false}
              // Figma draws the idle Apply as a flat #E5E7EB pill, not faded red.
              style={code.trim() ? styles.applyButton : { ...styles.applyButton, ...styles.applyIdle }}
            />
          </View>
          {suggested?.code && !promoCode && !single?.promotion.promo && !promoError ? (
            <Text variant="microRegular" color={colors.textMuted}>
              Try “{suggested.code}” for {promoSaving(suggested)}
            </Text>
          ) : null}
          {promoError ? (
            <Text variant="bodySm" color={colors.primary}>
              {promoError}
            </Text>
          ) : null}
          {promoCode && promoGroup ? (
            <View style={styles.promoApplied}>
              <Text
                variant="bodySm"
                color={promoGroup.promotion.codeError ? colors.textMuted : colors.success}
                style={styles.flex}
              >
                {promoGroup.promotion.codeError
                  ? `${promoCode} not applied — ${promoGroup.promotion.codeError}`
                  : `${promoCode} applied to ${promoGroup.merchantName} — you save ${formatMoney(promoGroup.promotion.discount)}.`}
              </Text>
              <Pressable accessibilityRole="button" onPress={clearPromo} hitSlop={8}>
                <Text variant="label" color={colors.primary}>
                  Remove
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {pricing.anyDelivery ? (
          <Card style={styles.block}>
            <Text variant="h4" color={colors.textHeading}>
              Deliver to
            </Text>
            <View style={styles.addressRow}>
              <View style={styles.addressIcon}>
                <Icon name="mapPin" size={16} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="labelMd" color={colors.textStrong} numberOfLines={1}>
                  {address ? addressTitle(address) : 'No delivery address yet'}
                </Text>
                <Text variant="bodyRegular" color={colors.textSecondary} numberOfLines={1}>
                  {address ? addressSubtitle(address) : 'Add one to see delivery fees'}
                </Text>
              </View>
              <Pressable onPress={() => (address ? setAddressOpen(true) : onAddress({ label: 'Home' }))} hitSlop={8}>
                <Text variant="label" color={colors.primary}>
                  {address ? 'Change' : 'Add'}
                </Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        <Card style={styles.block}>
          <Text variant="h4" color={colors.textHeading}>
            Order Summary
          </Text>
          <SummaryRow label={`Items (${lines.reduce((n, l) => n + l.qty, 0)})`} value={formatMoney(pricing.subtotal)} />
          {pricing.discount > 0 ? (
            <SummaryRow label="Offers & promos" value={`-${formatMoney(pricing.discount)}`} accent />
          ) : null}
          {deliveries ? (
            <SummaryRow
              label={deliveries > 1 ? `Delivery fees (${deliveries})` : 'Delivery fee'}
              value={pricing.needsAddress ? 'Set address' : pricing.deliveryFees === 0 ? 'Free' : formatMoney(pricing.deliveryFees)}
              accent={!pricing.needsAddress && pricing.deliveryFees === 0}
            />
          ) : (
            <SummaryRow label="Takeaway" value="No delivery fee" accent />
          )}
          <View style={styles.totalRule} />
          <View style={styles.summaryRow}>
            <Text variant="h4" color={colors.textHeading}>
              Total
            </Text>
            <Text variant="h4" color={colors.primary}>
              {formatMoney(pricing.total)}
            </Text>
          </View>
          {groups.length > 1 ? (
            <Text variant="microRegular" color={colors.textMuted}>
              {groups.length} orders — one from each restaurant, each delivered or picked up on its own — paid
              together at checkout.
            </Text>
          ) : null}
        </Card>
      </ScrollView>

      <View style={styles.subtotalStrip}>
        <Text variant="h4" color={colors.onPrimary}>
          Total
        </Text>
        <Text variant="h4" color={colors.onPrimary}>
          {formatMoney(pricing.total)}
        </Text>
      </View>

      <BottomBar includeBottomInset={!inTab}>
        <Button
          label={
            closed ? `${closed.merchantName} ${closed.missing ? 'is unavailable' : 'is closed'}` : 'Go to Checkout'
          }
          trailingIcon={closed ? undefined : <Icon name="chevronRight" size={16} color={colors.onPrimary} />}
          onPress={onCheckout}
          disabled={!!closed}
        />
      </BottomBar>
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
          onAddress({ addressId: next.id });
        }}
        onAdd={(intent) => {
          setAddressOpen(false);
          onAddress(intent);
        }}
        onClose={() => setAddressOpen(false)}
      />
    </Screen>
  );
}

/** One restaurant's share of the cart: its dishes, Delivery / Takeaway and any offer. */
function RestaurantCard({
  group,
  expanded,
  onToggle,
  onFulfilment,
  onChangeAddress,
  onPin,
  onAddAddress,
}: {
  group: PricedGroup;
  expanded: boolean;
  onToggle: () => void;
  onFulfilment: (f: 'delivery' | 'pickup') => void;
  onChangeAddress: () => void;
  onPin: () => void;
  onAddAddress: () => void;
}) {
  const { merchant, quote, promotion } = group;
  // "Add Rs. 320 more for free delivery" while that restaurant's threshold is in reach.
  const toFree =
    group.fulfilment === 'delivery' && merchant?.freeDeliveryOver && quote?.ok && group.deliveryFee > 0
      ? merchant.freeDeliveryOver - group.subtotal
      : 0;
  return (
    <Card style={styles.block}>
      <Pressable style={styles.groupHead} onPress={onToggle} accessibilityRole="button" accessibilityLabel={`${group.merchantName}, ${group.itemCount} items, ${formatMoney(group.subtotal)}. ${expanded ? 'Hide' : 'Show'} dishes`} accessibilityState={{ expanded }}>
        <View style={styles.addressIcon}>
          <Icon name="store" size={16} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="h4" color={colors.textHeading} numberOfLines={1}>
            {group.merchantName}
          </Text>
          <Text variant="bodySm" color={colors.textSecondary}>
            {group.itemCount} item{group.itemCount === 1 ? '' : 's'} · {formatMoney(group.subtotal)} · {group.fulfilment === 'pickup' ? 'Takeaway' : 'Delivery'}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: expanded ? '270deg' : '90deg' }] }}><Icon name="chevronRight" size={20} color={colors.primary} /></View>
      </Pressable>

      {group.closed || group.missing ? (
        <View accessibilityRole="alert" style={styles.notice}>
          <Icon name={group.missing ? 'warning' : 'clock'} size={16} color={colors.primary} />
          <Text variant="bodySm" color={colors.primary} style={styles.flex}>
            {group.missing
              ? `${group.merchantName} isn't available right now. Remove its dishes to check out the rest.`
              : `${group.merchantName} is closed right now. Remove its dishes to check out the rest, or wait until it opens.`}
          </Text>
        </View>
      ) : null}

      {expanded ? <View style={styles.restaurantBody}>
      {group.lines.map((line) => (
        <LineRow key={line.lineId} line={line} promo={promotion.promo} />
      ))}

      <FulfilmentToggle compact merchant={merchant} quote={quote} value={group.fulfilment} onChange={onFulfilment} />
      {quote && !quote.ok && (group.fulfilment === 'delivery' || quote.reason === 'outOfRange') ? (
        <DeliveryAreaNotice
          quote={quote}
          merchantName={group.merchantName}
          onChangeAddress={onChangeAddress}
          onPin={onPin}
          onAddAddress={onAddAddress}
        />
      ) : null}
      {toFree > 0 ? (
        <Text variant="microRegular" color={colors.textMuted}>
          Add {formatMoney(toFree)} more from {group.merchantName} for free delivery
        </Text>
      ) : null}
      {promotion.discount > 0 ? (
        <View style={styles.offerRow}>
          <Icon name="offers" size={14} color={colors.success} />
          <Text variant="bodySm" color={colors.success} style={styles.flex}>
            {promotion.automatic
              ? `${promotion.label} (${promotion.promo ? discountLabel(promotion.promo) : ''}) — the best offer for this order, you save ${formatMoney(promotion.discount)}`
              : `Promo ${promotion.label} — you save ${formatMoney(promotion.discount)}`}
          </Text>
        </View>
      ) : null}
      </View> : null}
    </Card>
  );
}

function LineRow({ line, promo }: { line: CartLine; promo: Promotion | null }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  // This dish's share of the applied offer — the bill's discount is the sum.
  const saving = promo ? lineDiscount(promo, line) : 0;
  const full = line.unitPrice * line.qty;
  return (
    <View style={styles.line}>
      <Image source={resolveImage(line.image)} style={styles.thumb} contentFit="cover" />
      <View style={styles.flex}>
        <View style={styles.lineHead}>
          <Text variant="h5" color={colors.textStrong} numberOfLines={1} style={styles.flex}>
            {line.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${line.name}`}
            onPress={() => remove(line.lineId)}
            hitSlop={8}
          >
            <Icon name="trash" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
        {line.selectedOptions.length ? (
          <View style={styles.optionChips}>
            {line.selectedOptions.map((o) => (
              <View key={`${o.groupKey}-${o.choiceId}`} style={[styles.optionChip, o.priceDelta > 0 && styles.optionChipPaid]}>
                <Text variant="micro" color={o.priceDelta > 0 ? colors.primary : colors.textSecondary}>
                  {o.priceDelta > 0 ? `+${o.label}` : o.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.lineFoot}>
          <View style={styles.linePrice}>
            <Text variant="h4" color={colors.primary}>
              {formatMoney(full - saving)}
            </Text>
            {saving > 0 ? (
              <>
                <Text variant="captionRegular" color={colors.textMuted} style={styles.was}>
                  {formatMoney(full)}
                </Text>
                <Text variant="captionBold" color={colors.success}>
                  {promo ? discountLabel(promo) : ''}
                </Text>
              </>
            ) : null}
          </View>
          <QuantityStepper value={line.qty} onChange={(q) => setQty(line.lineId, q)} min={0} />
        </View>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.summaryRow}>
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

  block: { gap: spacing[4] },
  restaurantBody: { gap: spacing[4] },
  groupHead: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing[4] },

  line: {
    flexDirection: 'row',
    gap: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.xl, backgroundColor: colors.surfaceAlt },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  optionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingTop: spacing[2] },
  optionChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  optionChipPaid: { backgroundColor: colors.primaryTint },
  lineFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
  },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  linePrice: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing[2], flexShrink: 1 },
  was: { textDecorationLine: 'line-through' },

  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  promoApplied: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  // Figma: 39.5 high · pad 10/14 · r10 · 500 13/15.6. `minWidth: 0` lets the
  // web <input> shrink below its intrinsic width so Apply stays in the card at
  // 320pt.
  promoInput: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    lineHeight: 15.6,
    color: colors.text,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    minHeight: 39.5,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  applyButton: {
    paddingHorizontal: spacing[6],
    minHeight: 39.5,
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
    flexShrink: 0,
  },
  applyIdle: { backgroundColor: colors.border, opacity: 1 },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
  },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalRule: { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },

  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },

  subtotalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[5],
    backgroundColor: colors.primary,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[8] },
  emptyCta: { paddingHorizontal: spacing[9], marginTop: spacing[4] },
});
