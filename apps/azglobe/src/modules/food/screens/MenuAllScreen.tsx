import { useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Screen, showToast, Text, ScreenHeader } from '@core/ui';
import { SearchBar } from '@core/ui/SearchBar';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { MenuItemRow } from '../components/MenuItemRow';
import { useActiveOffers, useMenu, useMerchant } from '../hooks/queries';
import { itemOffer } from '../services/promotions';
import { useAddToCart } from '../hooks/useAddToCart';
import type { FoodStackParamList } from '../navigation/types';
import type { MenuItem } from '../types';
import { HeroActions } from '../components/HeroActions';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/** The chip for dishes on offer. */
const OFFERS = 'On offer';

/**
 * All Menu Items — Figma 26:10198.
 *
 * Sticky top block (title + subtitle, search, category chips) over a scrolling
 * list of MenuItemRows. The block sits on a 1px #E5E7EB rule.
 */
export function MenuAllScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'MenuAll'>>();
  const [category, setCategory] = useState(params.offers ? OFFERS : 'All');
  const [search, setSearch] = useState('');

  const { data: merchant } = useMerchant(params.merchantId);
  const { data, isLoading } = useMenu(params.merchantId);
  const addToCart = useAddToCart();
  const closed = merchant?.isOpen === false;
  const add = (item: MenuItem) => {
    if (closed) {
      showToast(`${merchant?.name ?? 'This restaurant'} is closed right now`, { tone: 'error' });
      return;
    }
    addToCart(item);
  };

  const items = data ?? [];
  // Dishes the restaurant's running offer covers get their own chip.
  const { data: offers } = useActiveOffers(params.merchantId);
  const offered = (i: MenuItem) => !!offers && i.available !== false && itemOffer(offers, i) !== null;
  const hasOffers = items.some(offered);
  const categories = useMemo(
    () => ['All', ...(hasOffers ? [OFFERS] : []), ...new Set(items.map((i) => i.category))],
    [items, hasOffers]
  );

  const visible = items.filter((i) => {
    const byCategory = category === 'All' || (category === OFFERS ? offered(i) : i.category === category);
    const q = search.trim().toLowerCase();
    const bySearch = !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
    return byCategory && bySearch;
  });

  return (
    <Screen>
      <View style={styles.top}>
        <ScreenHeader
          title="All Menu Items"
          subtitle={merchant ? (closed ? `${merchant.name} · Closed` : merchant.name) : undefined}
          onBack={navigation.goBack}
          action={<HeroActions />}
        />

        <View style={styles.searchWrap}>
          <SearchBar placeholder="Search dishes…" value={search} onChangeText={setSearch} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map((c) => (
            <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <MenuItemRow
            item={item}
            showDivider={index < visible.length - 1}
            onPress={() =>
              navigation.navigate('ItemDetail', {
                merchantId: params.merchantId,
                menuItemId: item.id,
              })
            }
            addDisabled={closed}
            onAdd={() => add(item)}
          />
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text variant="bodyLg" color={colors.textMuted} align="center">
                {search.trim()
                  ? `No dishes match “${search.trim()}”.`
                  : items.length
                    ? 'Nothing in this category yet.'
                    : 'This restaurant hasn’t added its menu yet.'}
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing[3] },
  flex: { flex: 1 },
  searchWrap: { paddingHorizontal: SCREEN_PADDING },
  chipRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[4] },
  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[9] },
  empty: { paddingVertical: spacing[12] },
});
