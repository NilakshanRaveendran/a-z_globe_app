import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { SectionHeader } from '@core/ui/SectionHeader';
import { SCREEN_PADDING, spacing } from '@core/theme';
import type { RootStackParamList } from '@app/navigation/types';
import { FoodCard } from './FoodCard';
import { FoodCardSkeleton } from './FoodCardSkeleton';
import { EmptyState } from '@core/ui/EmptyState';
import { useCart } from '../store/cart';
import { usePopularDishes } from '../hooks/queries';
import type { MenuItem } from '../types';

/**
 * "Popular Dishes" on the Home screen (324:1708) — a 2×2 grid of FoodCards.
 *
 * Contributed to Home through the module registry, so the shell never imports
 * anything food-specific.
 *
 * Figma: section pad 24/16 · header, then a 12pt gap, then a 2-column grid with
 * 12pt gaps both ways (cards 174.5 wide inside a 361 container).
 */
export function PopularDishesSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, isLoading } = usePopularDishes();
  const addLine = useCart((s) => s.addFromMenuItem);

  const openLanding = () => navigation.navigate('Food', { screen: 'FoodLanding' });
  const openItem = (dish: MenuItem) =>
    navigation.navigate('Food', {
      screen: 'ItemDetail',
      params: { merchantId: dish.merchantId, menuItemId: dish.id },
    });

  const dishes = data ?? [];
  const rows: Array<MenuItem[]> = [];
  for (let i = 0; i < dishes.length; i += 2) rows.push(dishes.slice(i, i + 2));

  return (
    <View style={styles.section}>
      <SectionHeader title="Popular Dishes" size="md" onSeeAll={openLanding} />

      <View style={styles.grid}>
        {!isLoading && !dishes.length ? (
          <EmptyState
            title="No dishes yet"
            message="Popular dishes will show up here once restaurants add their menus."
          />
        ) : isLoading ? (
          <>
            <View style={styles.row}>
              <FoodCardSkeleton />
              <FoodCardSkeleton />
            </View>
            <View style={styles.row}>
              <FoodCardSkeleton />
              <FoodCardSkeleton />
            </View>
          </>
        ) : (
          rows.map((pair, i) => (
            <View key={i} style={styles.row}>
              {pair.map((dish) => (
                <FoodCard
                  key={dish.id}
                  item={dish}
                  onPress={() => openItem(dish)}
                  onAdd={() => addLine(dish)}
                />
              ))}
              {/* Keeps a lone trailing card at half width instead of stretching. */}
              {pair.length === 1 ? <View style={styles.spacer} /> : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[9],
    gap: spacing[4],
  },
  grid: { gap: spacing[4] },
  row: { flexDirection: 'row', gap: spacing[4] },
  spacer: { flex: 1 },
});
