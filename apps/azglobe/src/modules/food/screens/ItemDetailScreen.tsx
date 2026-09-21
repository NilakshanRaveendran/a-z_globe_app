import { useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomBar, Button, Icon, OptionButton, QuantityStepper, Screen, Text } from '@core/ui';
import { Skeleton } from '@core/ui/Skeleton';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatDelta, formatMoney } from '@core/utils/currency';
import { resolveImage } from '../data/images';
import { useMenuItem } from '../hooks/queries';
import { unitPriceFor, useCart } from '../store/cart';
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
 *   footer  quantity stepper + "Add to Cart — Rs. X"
 */
export function ItemDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'ItemDetail'>>();
  const { data: item, isLoading } = useMenuItem(params.merchantId, params.menuItemId);

  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [choices, setChoices] = useState<Record<string, string[]>>({});

  // Required single-choice groups open on their declared default — Regular and
  // Medium in the design — falling back to the first choice if none is set.
  const selection = useMemo<Record<string, string[]>>(() => {
    if (!item) return {};
    const defaults: Record<string, string[]> = {};
    for (const group of item.optionGroups) {
      if (group.type === 'single' && group.required) {
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

  if (isLoading || !item) {
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
  const total = unitPrice * qty;

  const toggle = (group: OptionGroup, choiceId: string) =>
    setChoices((prev) => {
      const current = prev[group.key] ?? selection[group.key] ?? [];
      if (group.type === 'single') return { ...prev, [group.key]: [choiceId] };
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={navigation.goBack}
            style={({ pressed }) => [styles.back, { top: insets.top + spacing[3] }, pressed && styles.pressed]}
          >
            <Icon name="arrowLeft" size={18} color={colors.palette.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="h1" color={colors.textHeading} style={styles.title}>
              {item.name}
            </Text>
            <Text variant="h1" color={colors.primary} style={styles.price}>
              {formatMoney(item.price)}
            </Text>
          </View>
          <Text variant="bodyLg" color={colors.textSecondary}>
            {item.description}
          </Text>

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
                <View>
                  {group.choices.map((choice, i, arr) => {
                    const checked = (selection[group.key] ?? []).includes(choice.id);
                    return (
                      <Pressable
                        key={choice.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        onPress={() => toggle(group, choice.id)}
                        style={[styles.addonRow, i < arr.length - 1 && styles.addonDivider]}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                          {checked ? (
                            <Text variant="labelSm" color={colors.onPrimary}>
                              ✓
                            </Text>
                          ) : null}
                        </View>
                        <Text variant="bodyLg" color={colors.textStrong} style={styles.flex}>
                          {choice.label}
                        </Text>
                        <Text variant="bodyLg" color={colors.textSecondary}>
                          {formatDelta(choice.priceDelta)}
                        </Text>
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
          <QuantityStepper value={qty} onChange={setQty} />
          <Button
            label={`Add to Cart — ${formatMoney(total)}`}
            leadingIcon={<Icon name="cart" size={16} color={colors.onPrimary} />}
            onPress={() => {
              add(item, selectedOptions, qty);
              navigation.navigate('Cart');
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
  back: {
    position: 'absolute',
    left: SCREEN_PADDING,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.8 },

  body: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[4], gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[4] },
  title: { fontSize: 24, lineHeight: 32, flex: 1 },
  price: { fontSize: 22, lineHeight: 32 },

  group: { paddingTop: spacing[6], gap: spacing[4] },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  optionRow: { flexDirection: 'row', gap: spacing[3.5] },

  addonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: spacing[5] },
  addonDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  flex: { flex: 1 },
});
