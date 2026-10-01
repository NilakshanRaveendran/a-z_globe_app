import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Screen, Text, ScreenHeader, SeeAllButton } from '@core/ui';
import { SearchBar } from '@core/ui/SearchBar';
import { Skeleton } from '@core/ui/Skeleton';
import { EmptyState } from '@core/ui/EmptyState';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { CuisineChip } from '../components/CuisineChip';
import { CategoryCircle } from '../components/CategoryCircle';
import { FeaturedCard } from '../components/FeaturedCard';
import { FeaturedTile } from '../components/FeaturedTile';
import { TopSpotTile } from '../components/TopSpotTile';
import { HeroActions } from '../components/HeroActions';
import { useMerchants } from '../hooks/queries';
import { landingCategories, landingCuisines } from '../data/landing';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * Order Food landing page — Figma 31:11648.
 *
 * Header (pad 10/16) · cuisine chips · category circles · filter pills ·
 * search · "Featured on A-Z Globe" (hero + 2 tiles) · "Top Spots Near You".
 *
 * The chips and the circles set one cuisine filter between them: the chip or
 * circle for the active cuisine is highlighted ("All" only when nothing is
 * picked), tapping an active circle clears it, and circles no restaurant
 * serves are hidden. The first filter pill is "Takeaway": it lists places that
 * offer takeaway, while ordering in the app is delivery only — so it does not
 * promise a pickup order the checkout cannot place.
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

  // Unfiltered list (the same query Home uses) — decides which circles have data.
  const { data: everyMerchant } = useMerchants();
  const categories = useMemo(() => {
    const served = new Set((everyMerchant ?? []).flatMap((m) => m.cuisines.map((c) => c.trim().toLowerCase())));
    return landingCategories.filter((c) => served.has(c.cuisine.toLowerCase()));
  }, [everyMerchant]);
  const isCuisine = (value: string) => cuisine.toLowerCase() === value.toLowerCase();

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
      {/* The shared header: back, title, bell + cart — the same on every food screen. */}
      <ScreenHeader title="Order Food" onBack={navigation.goBack} action={<HeroActions />} />

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
              selected={isCuisine(c.label)}
              onPress={() => setCuisine(c.label)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((c) => (
            <CategoryCircle
              key={c.key}
              categoryKey={c.key}
              label={c.label}
              selected={isCuisine(c.cuisine)}
              onPress={() => setCuisine(isCuisine(c.cuisine) ? 'All' : c.cuisine)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterPill
            icon="filterPickup"
            label="Takeaway"
            accessibilityLabel="Places that offer takeaway"
            active={pickupOnly}
            onPress={() => setPickupOnly((v) => !v)}
          />
          <FilterPill icon="filterOffers" label="Offers" active={offersOnly} onPress={() => setOffersOnly((v) => !v)} />
          <FilterPill
            icon="rupee"
            label="Under Rs.500"
            active={underFive}
            onPress={() => setUnderFive((v) => !v)}
          />
        </ScrollView>

        <View style={styles.searchWrap}>
          <SearchBar placeholder="Search restaurants or dishes" onPress={() => navigation.navigate('Search')} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="h2" color={colors.palette.ink}>
              Featured on A-Z Globe
            </Text>
            <SeeAllButton section="Featured on A-Z Globe" onPress={() => navigation.navigate('Featured')} />
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
            <SeeAllButton
              section="Top Spots Near You"
              onPress={() => navigation.navigate('Featured', { title: 'Top Spots Near You' })}
            />
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

/**
 * Figma: h33 · r:pill · #FFF + #E5E7EB border · row gap 5 · pad 7/12 · label 12/18.
 * The price pill's glyph is Figma's "₨" set in Inter 700 9pt — drawn here as
 * "Rs" text so every platform shows the LKR sign, never the Indian "₹".
 */
function FilterPill({
  icon,
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  icon: 'filterPickup' | 'filterOffers' | 'rupee';
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const tint = active ? colors.primary : colors.palette.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterPill,
        active ? styles.filterActive : styles.filterInactive,
        pressed && styles.pressed,
      ]}
    >
      {icon === 'rupee' ? (
        <View style={styles.rsGlyph}>
          <Text color={tint} style={styles.rsText}>
            Rs
          </Text>
        </View>
      ) : (
        <Icon name={icon} size={14} color={tint} />
      )}
      <Text variant="bodySm" color={tint}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Figma: 30×30 · r:pill · #F3F4F6 · chevron 15 #4B5563 */
const styles = StyleSheet.create({

  content: { paddingBottom: spacing[9] },

  cuisineRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[0.5] },
  // Figma: pad 12/12/6/12 around the circles, then the 54pt filter row with its
  // 33pt pills centred, then the 65.5pt search block — about 20pt between the
  // circle labels and the pills, and between the pills and the search pill.
  categoryRow: {
    gap: spacing[0.5],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2.5],
  },
  filterRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[5] },

  searchWrap: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[8], paddingBottom: spacing[3.5] },

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


  hidden: { display: 'none' },

  rsGlyph: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  rsText: { fontFamily: 'Urbanist_800ExtraBold', fontSize: 9, lineHeight: 11 },

  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
});
