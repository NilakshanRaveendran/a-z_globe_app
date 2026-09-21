import { useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Icon, Screen, Text } from '@core/ui';
import { SearchBar } from '@core/ui/SearchBar';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { MenuItemRow } from '../components/MenuItemRow';
import { useMenu, useMerchant } from '../hooks/queries';
import { useCart } from '../store/cart';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * All Menu Items — Figma 26:10198.
 *
 * Sticky top block (title + subtitle, search, category chips) over a scrolling
 * list of MenuItemRows. The block sits on a 1px #E5E7EB rule.
 */
export function MenuAllScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'MenuAll'>>();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const { data: merchant } = useMerchant(params.merchantId);
  const { data } = useMenu(params.merchantId);
  const addLine = useCart((s) => s.addFromMenuItem);

  const items = data ?? [];
  const categories = useMemo(
    () => ['All', ...new Set(items.map((i) => i.category))],
    [items]
  );

  const visible = items.filter((i) => {
    const byCategory = category === 'All' || i.category === category;
    const q = search.trim().toLowerCase();
    const bySearch = !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
    return byCategory && bySearch;
  });

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={navigation.goBack}
            hitSlop={8}
          >
            <Icon name="arrowLeft" size={18} color={colors.textHeading} />
          </Pressable>
          <View style={styles.flex}>
            <Text variant="h1" color={colors.textHeading} style={styles.title}>
              All Menu Items
            </Text>
            <Text variant="bodyLg" color={colors.textMuted}>
              {merchant?.name ?? ''}
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <SearchBar placeholder="Search dishes..." value={search} onChangeText={setSearch} />
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
            onAdd={() => addLine(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="bodyLg" color={colors.textMuted} align="center">
              No dishes match “{search}”.
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing[3] },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[4],
  },
  // Figma sets this at 24/30.
  title: { fontSize: 24, lineHeight: 30 },
  flex: { flex: 1 },
  searchWrap: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[5] },
  chipRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[4] },
  list: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[9] },
  empty: { paddingVertical: spacing[12] },
});
