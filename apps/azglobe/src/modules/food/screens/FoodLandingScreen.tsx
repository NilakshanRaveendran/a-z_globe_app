import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Screen, Text } from '@core/ui';
import { SearchBar } from '@core/ui/SearchBar';
import { Skeleton } from '@core/ui/Skeleton';
import { EmptyState } from '@core/ui/EmptyState';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { CuisineChip } from '../components/CuisineChip';
import { CategoryCircle } from '../components/CategoryCircle';
import { FeaturedCard } from '../components/FeaturedCard';
import { FeaturedTile } from '../components/FeaturedTile';
import { TopSpotTile } from '../components/TopSpotTile';
import { useMerchants } from '../hooks/queries';
import { landingCategories, landingCuisines } from '../data/landing';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * Order Food landing page — Figma 31:11648.
 *
 * Header (pad 10/16) · cuisine chips · category circles · filter pills ·
 * search · "Featured on A-Z Globe" (hero + 2 tiles) · "Top Spots Near You".
 */
export function FoodLandingScreen() {
  const navigation = useNavigation<Nav>();
  const [cuisine, setCuisine] = useState('All');
  const [pickupOnly, setPickupOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [underFive, setUnderFive] = useState(false);

  const { data, isLoading } = useMerchants({
    cuisine,
    takeawayOnly: pickupOnly,
    offersOnly,
    maxItemPrice: underFive ? 500 : undefined,
  });

  const merchants = data ?? [];
  const [hero, ...rest] = merchants;
  const featuredTiles = rest.slice(0, 2);
  const topSpots = merchants.slice(0, 4);
  // Figma lays these out two per row; flex-wrap would let all four share one line.
  const topSpotRows: (typeof topSpots)[] = [];
  for (let i = 0; i < topSpots.length; i += 2) topSpotRows.push(topSpots.slice(i, i + 2));

  const anyFilterActive = cuisine !== 'All' || pickupOnly || offersOnly || underFive;
  const clearFilters = () => {
    setCuisine('All');
    setPickupOnly(false);
    setOffersOnly(false);
    setUnderFive(false);
  };

  const openRestaurant = (merchantId: string) => navigation.navigate('Restaurant', { merchantId });

  return (
    <Screen>
      {/* Header — Figma: back chevron + "Order Food" 22/33, bell on the right */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          hitSlop={8}
          style={styles.headerBack}
        >
          <Icon name="arrowLeft" size={18} color={colors.palette.ink} />
          <Text variant="h1" color={colors.palette.ink} style={styles.headerTitle}>
            Order Food
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8}>
          <Icon name="bell" size={22} color={colors.palette.ink} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cuisineRow}
        >
          {landingCuisines.map((c) => (
            <CuisineChip
              key={c.key}
              cuisineKey={c.key}
              label={c.label}
              selected={cuisine === c.label}
              onPress={() => setCuisine(c.label)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {landingCategories.map((c) => (
            <CategoryCircle
              key={c.key}
              categoryKey={c.key}
              label={c.label}
              onPress={() => setCuisine(c.label)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterPill icon="filterPickup" label="Pickup" active={pickupOnly} onPress={() => setPickupOnly((v) => !v)} />
          <FilterPill icon="filterOffers" label="Offers" active={offersOnly} onPress={() => setOffersOnly((v) => !v)} />
          <FilterPill
            icon="rupee"
            label="Under Rs.500"
            active={underFive}
            onPress={() => setUnderFive((v) => !v)}
          />
        </ScrollView>

        <View style={styles.searchWrap}>
          <SearchBar placeholder="Search restaurants or dishes" onPress={() => navigation.navigate('Featured')} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="h2" color={colors.palette.ink}>
              Featured on A-Z Globe
            </Text>
            <CircleChevron onPress={() => navigation.navigate('Featured')} />
          </View>

          {isLoading ? (
            <View style={styles.sectionBody}>
              <Skeleton height={210} borderRadius={18} />
            </View>
          ) : hero ? (
            <>
              <View style={styles.sectionBody}>
                <FeaturedCard merchant={hero} onPress={() => openRestaurant(hero.id)} />
              </View>
              <View style={styles.tileRow}>
                {featuredTiles.map((m) => (
                  <FeaturedTile key={m.id} merchant={m} onPress={() => openRestaurant(m.id)} />
                ))}
              </View>
            </>
          ) : (
            <EmptyState
              icon="search"
              title="No restaurants here yet"
              message={
                anyFilterActive
                  ? 'Try clearing a filter to see more places.'
                  : 'We could not find any restaurants near you right now.'
              }
              {...(anyFilterActive ? { actionLabel: 'Clear filters', onAction: clearFilters } : {})}
            />
          )}
        </View>

        <View style={[styles.topSpots, !topSpots.length && styles.hidden]}>
          <View style={styles.sectionHead}>
            <View style={styles.flex}>
              <Text variant="h2" color={colors.palette.ink}>
                Top Spots Near You
              </Text>
              <Text variant="bodyRegular" color={colors.textMuted}>
                Most ordered this week
              </Text>
            </View>
            <CircleChevron onPress={() => navigation.navigate('Featured')} />
          </View>

          <View style={styles.topSpotGrid}>
            {topSpotRows.map((row, i) => (
              <View key={i} style={styles.tileRowFlush}>
                {row.map((m) => (
                  <TopSpotTile key={m.id} merchant={m} onPress={() => openRestaurant(m.id)} />
                ))}
                {row.length === 1 ? <View style={styles.flex} /> : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Figma: h33 · r:pill · #FFF + #E5E7EB border · row gap 5 · pad 7/12 · label 12/18 */
function FilterPill({
  icon,
  label,
  active,
  onPress,
}: {
  icon: 'filterPickup' | 'filterOffers' | 'rupee';
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const tint = active ? colors.primary : colors.palette.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterPill,
        active ? styles.filterActive : styles.filterInactive,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={14} color={tint} />
      <Text variant="bodySm" color={tint}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Figma: 30×30 · r:pill · #F3F4F6 · chevron 15 #4B5563 */
function CircleChevron({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="See all"
      onPress={onPress}
      style={({ pressed }) => [styles.circleChevron, pressed && styles.pressed]}
    >
      <Icon name="chevronRight" size={15} color={colors.palette.gray600} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[3.5],
  },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  // Figma sets this title at 22/33, larger than the h1 preset.
  headerTitle: { fontSize: 22, lineHeight: 33 },

  content: { paddingBottom: spacing[9] },

  cuisineRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[0.5] },
  categoryRow: { gap: spacing[0.5], paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  filterRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[2.5] },

  searchWrap: { paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing[3.5] },

  section: { paddingTop: spacing[2.5] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing[4],
  },
  sectionBody: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[5] },
  tileRow: {
    flexDirection: 'row',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[3.5],
  },

  topSpots: { paddingTop: spacing[12] - 4, gap: spacing[5] },
  topSpotGrid: { gap: spacing[4], paddingHorizontal: SCREEN_PADDING },
  tileRowFlush: { flexDirection: 'row', gap: spacing[4] },

  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    borderWidth: 0.54,
  },
  filterActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  filterInactive: { backgroundColor: colors.surface, borderColor: colors.border },

  circleChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },

  hidden: { display: 'none' },

  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
});
