import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { BottomBar, Button, Card, Icon, QuantityStepper, Screen, ScreenHeader, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing, typography } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import { findPromoCode, ineligibleReason } from '../services/promotions';
import { useAppliedPromotion } from '../hooks/useAppliedPromotion';
import { useAddresses } from '../hooks/useAddresses';
import { addressSubtitle, addressTitle } from '../services/addresses';
import { AddressSearchSheet } from '../components/AddressSearchSheet';
import { useCart } from '../store/cart';
import { useMerchant } from '../hooks/queries';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * Your Cart — Figma 414:2985.
 *
 *   header       "Your Cart" + merchant name, circular back, item-count pill
 *   line items   thumb 64 · name · option chips · price · stepper · trash
 *   promo card   input + Apply
 *   summary      Subtotal / Delivery Fee / Total
 *   delivery     address row with a "Change" action
 *   footer       red subtotal strip + "Go to Checkout"
 */
export function CartScreen() {
  const navigation = useNavigation<Nav>();
  const { lines, merchantId, merchantName, promoCode, setQty, remove, applyPromo, clearPromo } =
    useCart();
  const applied = useAppliedPromotion();
  const promoDiscount = applied.discount;
  const subtotal = useCart((s) => s.subtotal());
  const { data: merchant } = useMerchant(merchantId ?? '');
  const [code, setCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const { addresses, selected: address, select } = useAddresses();

  const deliveryFee = merchant?.deliveryFee ?? 0;
  const total = Math.max(0, subtotal - promoDiscount) + deliveryFee;
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  const onApply = async () => {
    if (!merchantId) return;
    setApplying(true);
    try {
      // Check once here so a bad code is refused in place rather than stored;
      // from then on useAppliedPromotion keeps the figure in step with the cart.
      const promo = await findPromoCode(code);
      const reason = promo ? ineligibleReason(promo, merchantId, subtotal) : 'That promo code is not valid.';
      if (reason) {
        setPromoError(reason);
        return;
      }
      setPromoError(null);
      setCode('');
      applyPromo(code);
    } finally {
      setApplying(false);
    }
  };

  if (!lines.length) {
    return (
      <Screen>
        <ScreenHeader title="Your Cart" onBack={navigation.goBack} backStyle="circle" />
        <View style={styles.empty}>
          <Icon name="cart" size={40} color={colors.textMuted} />
          <Text variant="h3" color={colors.textStrong} align="center">
            Your cart is empty
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary} align="center">
            Add a dish and it will show up here.
          </Text>
          <Button
            label="Browse restaurants"
            onPress={() => navigation.navigate('FoodLanding')}
            fullWidth={false}
            style={styles.emptyCta}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Your Cart"
        subtitle={merchantName ?? undefined}
        onBack={navigation.goBack}
        backStyle="circle"
        action={
          <View style={styles.countPill}>
            <Text variant="labelSm" color={colors.onPrimary}>
              {itemCount}
            </Text>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {lines.map((line) => (
          <Card key={line.lineId} style={styles.lineCard}>
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
                    <View
                      key={`${o.groupKey}-${o.choiceId}`}
                      style={[styles.optionChip, o.priceDelta > 0 && styles.optionChipPaid]}
                    >
                      <Text
                        variant="micro"
                        color={o.priceDelta > 0 ? colors.primary : colors.textSecondary}
                      >
                        {o.priceDelta > 0 ? `+${o.label}` : o.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.lineFoot}>
                <Text variant="h4" color={colors.primary}>
                  {formatMoney(line.unitPrice * line.qty)}
                </Text>
                <QuantityStepper value={line.qty} onChange={(q) => setQty(line.lineId, q)} min={0} />
              </View>
            </View>
          </Card>
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
              style={styles.applyButton}
            />
          </View>
          {/* No suggested code: the old hint named a demo promo that no restaurant
              offers. Only real feedback is shown. */}
          {promoError || applied.codeError ? (
            <Text variant="bodySm" color={colors.primary}>
              {promoError ?? applied.codeError}
            </Text>
          ) : null}
          {promoCode ? (
            <View style={styles.promoApplied}>
              <Text variant="bodySm" color={applied.codeError ? colors.textMuted : colors.success} style={styles.flex}>
                {applied.codeError
                  ? `${promoCode} not applied`
                  : `${promoCode} applied — you save ${formatMoney(promoDiscount)}.`}
              </Text>
              <Pressable accessibilityRole="button" onPress={clearPromo} hitSlop={8}>
                <Text variant="label" color={colors.primary}>
                  Remove
                </Text>
              </Pressable>
            </View>
          ) : applied.promo ? (
            <Text variant="bodySm" color={colors.success}>
              {`${applied.label} applied — you save ${formatMoney(promoDiscount)}.`}
            </Text>
          ) : null}
        </Card>

        <Card style={styles.block}>
          <Text variant="h4" color={colors.textHeading}>
            Order Summary
          </Text>
          <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />
          {promoDiscount > 0 ? (
            <SummaryRow
              label={applied.automatic ? `Offer (${applied.label})` : `Promo (${applied.label})`}
              value={`-${formatMoney(promoDiscount)}`}
              accent
            />
          ) : null}
          <SummaryRow label="Delivery Fee" value={formatMoney(deliveryFee)} />
          <View style={styles.totalRule} />
          <View style={styles.summaryRow}>
            <Text variant="h4" color={colors.textHeading}>
              Total
            </Text>
            <Text variant="h4" color={colors.primary}>
              {formatMoney(total)}
            </Text>
          </View>
        </Card>

        <Card style={styles.block}>
          <Text variant="h4" color={colors.textHeading}>
            Delivery Details
          </Text>
          <View style={styles.addressRow}>
            <View style={styles.addressIcon}>
              <Icon name="mapPin" size={16} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyLg" color={colors.textStrong} numberOfLines={1}>
                {address ? `${addressTitle(address)} · ${addressSubtitle(address)}` : 'No delivery address yet'}
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {merchant ? `${merchant.prepTimeMin}–${merchant.prepTimeMax} min estimated delivery` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                address ? setAddressOpen(true) : navigation.navigate('AddressInfo', { label: 'Home' })
              }
              hitSlop={8}
            >
              <Text variant="body" color={colors.primary}>
                {address ? 'Change' : 'Add'}
              </Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>

      {/* Figma puts a solid red subtotal strip directly above the CTA. */}
      <View style={styles.subtotalStrip}>
        <Text variant="h4" color={colors.onPrimary}>
          Subtotal
        </Text>
        <Text variant="h4" color={colors.onPrimary}>
          {formatMoney(total)}
        </Text>
      </View>

      <BottomBar>
        <Button
          label="Go to Checkout"
          trailingIcon={<Icon name="chevronRight" size={16} color={colors.onPrimary} />}
          onPress={() => navigation.navigate('Checkout')}
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

  countPill: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing[2],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  lineCard: { flexDirection: 'row', gap: spacing[4] },
  thumb: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.surfaceAlt },
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

  block: { gap: spacing[3] },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  promoApplied: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  promoInput: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.text,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
  },
  applyButton: { paddingHorizontal: spacing[8] },

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
