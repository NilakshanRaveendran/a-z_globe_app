import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BackButton, EmptyState, Icon, Screen, showToast, Text } from '@core/ui';
import { Skeleton } from '@core/ui/Skeleton';
import { createStorage } from '@core/storage';
import { colors, radius, SCREEN_PADDING, spacing, typography } from '@core/theme';
import { formatPrepTime } from '@core/utils/currency';
import { MenuItemRow } from '../components/MenuItemRow';
import { resolveImage } from '../data/images';
import { foodKeys, useMerchants, useSearchCatalogue } from '../hooks/queries';
import { useAddToCart } from '../hooks/useAddToCart';
import { listPopularDishes } from '../services/merchants';
import type { FoodStackParamList } from '../navigation/types';
import type { MenuItem, Merchant } from '../types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

const DEBOUNCE_MS = 250;
const RECENT_MAX = 6;
const storage = createStorage({ id: 'azglobe.food.search' });

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getString('recent') ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  storage.set('recent', JSON.stringify(list.slice(0, RECENT_MAX)));
}

/**
 * Search restaurants or dishes — opened from the Order Food search bar
 * (31:11648) and from Home's "Popular Dishes · See all".
 *
 * There is no Figma frame for results, so the screen is assembled from the
 * design's own parts: the landing page's header and 45pt search pill, the
 * restaurant page's section headings, and the All Menu Items dish row
 * (26:10198) for dishes. Results come in two groups — Restaurants, then
 * Dishes — and update as the customer types (debounced). With nothing typed
 * it shows recent searches and the popular dishes.
 */
export function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'Search'>>();
  const addToCart = useAddToCart();
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);

  useEffect(() => {
    const id = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  const results = useSearchCatalogue(query);
  const popular = useQuery({
    queryKey: [...foodKeys.popular(), 20],
    queryFn: () => listPopularDishes(20),
    enabled: !query,
  });
  // Knowing which restaurants are closed keeps their dishes out of the cart.
  const { data: allMerchants } = useMerchants();
  const closedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of [...(allMerchants ?? []), ...(results.data?.merchants ?? [])]) {
      if (!m.isOpen) ids.add(m.id);
    }
    return ids;
  }, [allMerchants, results.data]);

  const remember = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    const next = [clean, ...recent.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_MAX);
    setRecent(next);
    writeRecent(next);
  };
  const clearRecent = () => {
    setRecent([]);
    storage.remove('recent');
  };
  const runSearch = (q: string) => {
    setText(q);
    setQuery(q.trim());
    remember(q);
  };

  const openRestaurant = (m: Merchant) => {
    remember(text);
    navigation.navigate('Restaurant', { merchantId: m.id });
  };
  const openDish = (d: MenuItem) => {
    remember(text);
    navigation.navigate('ItemDetail', { merchantId: d.merchantId, menuItemId: d.id });
  };
  const addDish = (d: MenuItem) => {
    if (closedIds.has(d.merchantId)) {
      showToast(`${d.merchantName} is closed right now`, { tone: 'error' });
      return;
    }
    addToCart(d);
  };

  const merchants = results.data?.merchants ?? [];
  const dishes = results.data?.dishes ?? [];
  const searching = Boolean(query) && (results.isLoading || text.trim() !== query);

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton onPress={navigation.goBack} />
        <View style={styles.bar}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search restaurants or dishes"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => remember(text)}
            autoFocus={params?.autoFocus !== false}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search restaurants or dishes"
          />
          {text ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => {
                setText('');
                setQuery('');
                inputRef.current?.focus();
              }}
              style={styles.clear}
            >
              <Icon name="close" size={10} color={colors.surface} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!query ? (
          <>
            {recent.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text variant="h4" color={colors.textHeading}>
                    Recent searches
                  </Text>
                  <Pressable accessibilityRole="button" onPress={clearRecent} hitSlop={8}>
                    <Text variant="label" color={colors.primary}>
                      Clear
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.recentRow}>
                  {recent.map((r) => (
                    <Pressable
                      key={r}
                      accessibilityRole="button"
                      accessibilityLabel={`Search for ${r}`}
                      onPress={() => runSearch(r)}
                      style={({ pressed }) => [styles.recentChip, pressed && styles.pressed]}
                    >
                      <Icon name="clockSm" size={12} color={colors.textMuted} />
                      <Text variant="label" color={colors.text}>
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="h4" color={colors.textHeading}>
                Popular dishes
              </Text>
              {popular.isLoading ? (
                <RowSkeletons />
              ) : (popular.data ?? []).length ? (
                <View>
                  {(popular.data ?? []).map((d, i, arr) => (
                    <MenuItemRow
                      key={`${d.merchantId}-${d.id}`}
                      item={d}
                      subtitle={d.merchantName}
                      addDisabled={closedIds.has(d.merchantId)}
                      showDivider={i < arr.length - 1}
                      onPress={() => openDish(d)}
                      onAdd={() => addDish(d)}
                    />
                  ))}
                </View>
              ) : (
                <Text variant="bodyLg" color={colors.textSecondary} style={styles.hint}>
                  Search for a restaurant, a cuisine like “Sri Lankan”, or a dish like “kottu”.
                </Text>
              )}
            </View>
          </>
        ) : searching ? (
          <View style={styles.section}>
            <RowSkeletons />
          </View>
        ) : results.isError ? (
          <EmptyState
            icon="warning"
            title="Search isn't working right now"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => void results.refetch()}
          />
        ) : !merchants.length && !dishes.length ? (
          <EmptyState
            icon="search"
            title={`No results for “${query}”`}
            message="Check the spelling, or try a cuisine like “Sri Lankan” or a dish like “kottu”."
          />
        ) : (
          <>
            {merchants.length ? (
              <View style={styles.section}>
                <SectionTitle title="Restaurants" count={merchants.length} />
                <View>
                  {merchants.map((m, i) => (
                    <RestaurantResult
                      key={m.id}
                      merchant={m}
                      showDivider={i < merchants.length - 1}
                      onPress={() => openRestaurant(m)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {dishes.length ? (
              <View style={styles.section}>
                <SectionTitle title="Dishes" count={dishes.length} />
                <View>
                  {dishes.map((d, i) => (
                    <MenuItemRow
                      key={`${d.merchantId}-${d.id}`}
                      item={d}
                      subtitle={d.merchantName}
                      addDisabled={closedIds.has(d.merchantId)}
                      showDivider={i < dishes.length - 1}
                      onPress={() => openDish(d)}
                      onAdd={() => addDish(d)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="h4" color={colors.textHeading}>
        {title}
      </Text>
      <Text variant="bodySm" color={colors.textMuted}>
        {count}
      </Text>
    </View>
  );
}

/**
 * A restaurant result — the Quick Add row's geometry (61.6 thumb · r15.4 ·
 * pad 14 · #F9FAFB rule) with the restaurant's name, cuisines and rating.
 */
function RestaurantResult({
  merchant,
  onPress,
  showDivider,
}: {
  merchant: Merchant;
  onPress: () => void;
  showDivider: boolean;
}) {
  const closed = !merchant.isOpen;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={closed ? `${merchant.name}, closed` : merchant.name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, showDivider && styles.divider, pressed && styles.pressed]}
    >
      <Image
        source={resolveImage(merchant.coverImage)}
        style={[styles.thumb, closed && styles.dim]}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text variant="h4" color={colors.text} style={[styles.name, styles.flexShrink]} numberOfLines={1}>
            {merchant.name}
          </Text>
          {closed ? (
            <View style={styles.closedPill}>
              <Text variant="captionBold" color={colors.textSecondary}>
                Closed
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1} style={styles.desc}>
          {merchant.cuisines.slice(0, 3).join(' · ') || merchant.tagline}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="star" size={16} color={colors.star} />
          <Text variant="labelSm" color={colors.text}>
            {merchant.reviewCount > 0 ? merchant.rating.toFixed(1) : 'New'}
          </Text>
          <Text variant="microRegular" color={colors.textMuted}>
            ·
          </Text>
          <Text variant="microRegular" color={colors.textSecondary}>
            {formatPrepTime(merchant.prepTimeMin, merchant.prepTimeMax)}
          </Text>
        </View>
      </View>
      <Icon name="chevronRight" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

function RowSkeletons() {
  return (
    <View style={styles.skeletons}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={61.6} height={61.6} borderRadius={15.4} />
          <View style={styles.skeletonText}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="85%" height={10} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Figma 31:11648 header: pad 10/16, chevron then the control.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[4],
  },
  // The landing page's search pill: h45 · r:pill · #F3F4F6 · gap 10 · pad 12/16.
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3.5],
    paddingHorizontal: spacing[6],
    minHeight: 45,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...typography.bodyLg,
    color: colors.text,
    paddingVertical: spacing[4],
  },
  clear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textMuted,
  },

  content: { paddingBottom: spacing[12] },
  section: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[6], gap: spacing[1.5] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { paddingTop: spacing[3] },

  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], paddingTop: spacing[3] },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    borderWidth: 0.54,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: spacing[5] },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceSunken },
  thumb: { width: 61.6, height: 61.6, borderRadius: 15.4, backgroundColor: colors.surfaceAlt },
  dim: { opacity: 0.45 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  name: { fontFamily: 'Urbanist_600SemiBold' },
  desc: { paddingTop: spacing[0.5] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingTop: spacing[2] },
  closedPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },

  skeletons: { gap: spacing[5], paddingTop: spacing[4] },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  skeletonText: { flex: 1, gap: spacing[2] },

  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  pressed: { opacity: 0.85 },
});
