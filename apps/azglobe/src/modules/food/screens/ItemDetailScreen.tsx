import { useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BottomBar, Button, Icon, OptionButton, QuantityStepper, Screen, showToast, Text } from '@core/ui';
import { Skeleton } from '@core/ui/Skeleton';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatDelta, formatMoney } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import { useMenuItem, useMerchant } from '../hooks/queries';
import { useAddToCart } from '../hooks/useAddToCart';
import { LoadErrorState } from '../components/LoadErrorState';
import { OfferPrice } from '../components/OfferPrice';
import { useItemOffer } from '../hooks/useItemOffer';
import { lineDiscount } from '../services/promotions';
import { formatDayMonth } from '@core/utils/datetime';
import { HeroTopBar } from '../components/HeroTopBar';
import { unitPriceFor } from '../store/cart';
import { closedLabel } from '../utils/hours';
import type { FoodStackParamList } from '../navigation/types';
import type { OptionGroup, SelectedOption } from '../types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * Item detail — Figma 116:3078 (nothing selected) and 116:3638 (Extra egg on,
 * which moves the CTA from "Rs. 450" to "Rs. 550").
 *
 *   hero    282pt image fading into the sheet, 40pt circular back button
 *   title   name Urbanist 700 ~24 with the price right-aligned in #D42B2B
 *   groups  Size (14/21 options, pad 11) · Spice Level (12/18, pad 10) ·
 *           Add-ons with "(Optional)" and checkbox rows
 *   footer  quantity stepper + "Add to Cart — Rs. X" ("Add · Rs. X" below
 *           360pt, where the long label would wrap and split "Rs." from the
 *           amount)
 *
 * A sold-out dish, or any dish while its restaurant is closed, keeps the page
 * readable but swaps the CTA for a disabled one saying why.
 */
export function ItemDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'ItemDetail'>>();
  const { width } = useWindowDimensions();
  const { data: item, isSuccess, isError, refetch } = useMenuItem(params.merchantId, params.menuItemId);
  const { data: merchant } = useMerchant(params.merchantId);
  const addToCart = useAddToCart();
  // The restaurant's running offer on this dish — the cart takes off the same.
  const offer = useItemOffer(item?.available === false ? null : item);
  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate('Restaurant', { merchantId: params.merchantId });
  const [qty, setQty] = useState(1);
  const [choices, setChoices] = useState<Record<string, string[]>>({});

  // Required single-choice groups open on their declared default — Regular and
  // Medium in the design — falling back to the first choice if none is set.
  const selection = useMemo<Record<string, string[]>>(() => {
    if (!item) return {};
    const defaults: Record<string, string[]> = {};
    for (const group of item.optionGroups) {
      if (group.type === 'single' && (group.required || group.defaultChoiceId)) {
        const preset =
          group.choices.find((c) => c.id === group.defaultChoiceId) ?? group.choices[0];
        if (preset) defaults[group.key] = [preset.id];
      } else {
        defaults[group.key] = [];
      }
    }
    return { ...defaults, ...choices };
  }, [item, choices]);

  const selectedOptions = useMemo<SelectedOption[]>(() => {
    if (!item) return [];
    return item.optionGroups.flatMap((group) =>
      (selection[group.key] ?? []).flatMap((choiceId) => {
        const choice = group.choices.find((c) => c.id === choiceId);
        return choice
          ? [
              {
                groupKey: group.key,
                groupLabel: group.label,
                choiceId: choice.id,
                label: choice.label,
                priceDelta: choice.priceDelta,
              },
            ]
          : [];
      })
    );
  }, [item, selection]);

  if (isError && !item) {
    return (
      <LoadErrorState
        title="Couldn't load this dish"
        message="Check your connection and try again."
        onBack={goBack}
        onRetry={() => void refetch()}
      />
    );
  }

  // A settled read that found nothing — not a slow or paused one.
  if (isSuccess && !item) {
    return (
      <LoadErrorState
        title="Dish not found"
        message="The restaurant may have taken it off the menu."
        onBack={goBack}
      />
    );
  }

  if (!item) {
    return (
      <Screen edges={[]}>
        <Skeleton height={282} borderRadius={0} />
        <View style={styles.loading}>
          <Skeleton width="60%" height={28} />
          <Skeleton width="85%" height={18} />
          <Skeleton height={62} borderRadius={radius.xl} />
        </View>
      </Screen>
    );
  }

  const unitPrice = unitPriceFor(item.price, selectedOptions);
  const fullTotal = unitPrice * qty;
  // As the cart works it out: this line's saving, rounded down.
  const total = offer?.price != null ? fullTotal - lineDiscount(offer.promo, { menuItemId: item.id, unitPrice, qty }) : fullTotal;
  const soldOut = item.available === false;
  const closed = merchant?.isOpen === false;
  const narrow = width < 360;
  const ctaLabel = soldOut
    ? 'Sold out'
    : closed
      ? closedLabel(merchant?.hours)
      : narrow
        ? `Add · ${formatMoney(total)}`
        : `Add to Cart — ${formatMoney(total)}`;

  const toggle = (group: OptionGroup, choiceId: string) =>
    setChoices((prev) => {
      const current = prev[group.key] ?? selection[group.key] ?? [];
      if (group.type === 'single') return { ...prev, [group.key]: !group.required && current.includes(choiceId) ? [] : [choiceId] };
      return {
        ...prev,
        [group.key]: current.includes(choiceId)
          ? current.filter((c) => c !== choiceId)
          : [...current, choiceId],
      };
    });

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image
            source={resolveImage(item.image)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.50)', 'rgba(0,0,0,0.10)', 'rgba(242,242,242,0.77)', '#FAFAFA']}
            locations={[0, 0.5, 0.88, 1]}
            style={StyleSheet.absoluteFill}
          />
          <HeroTopBar onBack={goBack} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="h1" color={colors.textHeading} style={styles.title}>
              {item.name}
            </Text>
            <OfferPrice price={item.price} offer={offer} variant="h1" style={styles.priceBlock} />
          </View>
          {merchant ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`From ${merchant.name}. Open restaurant`}
              onPress={() => navigation.navigate('Restaurant', { merchantId: merchant.id })}
              style={({ pressed }) => [styles.merchantRow, pressed && styles.pressed]}
            >
              <View style={styles.merchantIcon}>
                <Icon name="store" size={14} color={colors.primary} />
              </View>
              <Text variant="labelMd" color={colors.text} numberOfLines={1} style={styles.merchantName}>
                {merchant.name}
              </Text>
              <Icon name="star" size={16} color={colors.palette.amber400} />
              <Text variant="bodySm" color={colors.textSecondary}>
                {merchant.rating.toFixed(1)} · {merchant.prepTimeMin}–{merchant.prepTimeMax} min
              </Text>
              <Icon name="chevronRight" size={12} color={colors.textMuted} />
            </Pressable>
          ) : null}
          {offer ? (
            <View style={styles.offerNote}>
              <Icon name="offers" size={14} color={colors.primary} />
              <Text variant="bodySm" color={colors.primary} style={styles.flex}>
                {offer.label} at {merchant?.name ?? 'this restaurant'} · until {formatDayMonth(offer.promo.validUntil)}
                {offer.price == null ? ' — applied in your cart once you reach the minimum' : ' — applied in your cart'}
              </Text>
            </View>
          ) : null}
          <Text variant="bodyLg" color={colors.textSecondary}>
            {item.description}
          </Text>
          {soldOut ? (
            <View style={styles.notice}>
              <Icon name="warning" size={14} color={colors.textSecondary} />
              <Text variant="bodySm" color={colors.textSecondary} style={styles.flex}>
                Sold out right now — the restaurant hasn't got any left today.
              </Text>
            </View>
          ) : null}

          {item.optionGroups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHead}>
                <Text variant="h4" color={colors.textHeading}>
                  {group.label}
                </Text>
                {!group.required ? (
                  <Text variant="bodyLg" color={colors.textMuted}>
                    (Optional)
                  </Text>
                ) : null}
              </View>

              {group.type === 'multi' ? (
                <View style={styles.addonList}>
                  {group.choices.map((choice) => {
                    const checked = (selection[group.key] ?? []).includes(choice.id);
                    return (
                      <Pressable
                        key={choice.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        onPress={() => toggle(group, choice.id)}
                        accessibilityLabel={`${choice.label}, ${formatDelta(choice.priceDelta)}`}
                        style={({ pressed }) => [
                          styles.addonRow,
                          checked && styles.addonRowSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.flex}>
                          <Text variant="labelLg" color={colors.textStrong}>
                            {choice.label}
                          </Text>
                          <Text variant="bodySm" color={checked ? colors.primary : colors.textSecondary}>
                            {formatDelta(choice.priceDelta)}
                          </Text>
                        </View>
                        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                          <Icon name={checked ? 'check' : 'plus'} size={20} color={checked ? colors.onPrimary : colors.primary} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.optionRow}>
                  {group.choices.map((choice) => (
                    <OptionButton
                      key={choice.id}
                      label={choice.label}
                      subLabel={choice.priceDelta ? formatDelta(choice.priceDelta) : undefined}
                      selected={(selection[group.key] ?? []).includes(choice.id)}
                      size={group.key === 'size' ? 'lg' : 'sm'}
                      onPress={() => toggle(group, choice.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomBar>
        <View style={styles.footer}>
          {soldOut || closed ? null : <QuantityStepper value={qty} onChange={setQty} />}
          <Button
            label={ctaLabel}
            disabled={soldOut || closed}
            leadingIcon={
              soldOut || closed || narrow ? undefined : <Icon name="cart" size={16} color={colors.onPrimary} />
            }
            onPress={() => {
              if (closed) {
                showToast(`${merchant?.name ?? 'This restaurant'} is closed right now`, { tone: 'error' });
                return;
              }
              // Stay on the dish so another can be added; the toast links to the cart.
              addToCart(item, { options: selectedOptions, qty }, () => setQty(1));
            }}
            style={styles.flex}
          />
        </View>
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing[8] },
  loading: { padding: SCREEN_PADDING, gap: spacing[4] },
  hero: { height: 282, backgroundColor: colors.surfaceAlt },
  pressed: { opacity: 0.8 },

  body: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[4], gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[4] },
  title: { fontSize: 24, lineHeight: 32, flex: 1 },
  priceBlock: { flexShrink: 0, alignItems: 'baseline' },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  merchantIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  merchantName: { flexShrink: 1 },
  offerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
  },

  group: { paddingTop: spacing[6], gap: spacing[4] },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  optionRow: { flexDirection: 'row', gap: spacing[3.5] },

  addonList: { gap: spacing[3] },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: 76,
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  addonRowSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    marginTop: spacing[2],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
  },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  flex: { flex: 1 },
});
