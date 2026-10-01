import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SectionHeader } from '@core/ui/SectionHeader';
import { Skeleton } from '@core/ui/Skeleton';
import { EmptyState } from '@core/ui/EmptyState';
import { radius, SCREEN_PADDING, spacing } from '@core/theme';
import type { RootStackParamList } from '@app/navigation/types';
import { PlaceCard } from './PlaceCard';
import { useMerchants } from '../hooks/queries';

/**
 * "Popular Near You" on Home (324:1708): one full-width hero card followed by a
 * row of 160×200 tiles.
 *
 * Figma: section gap 14 · pad 0/16 · tile row gap 12.
 *
 * Built from the real restaurant list in both modes — Figma's Hotel tiles
 * (Trinco Blu, Hotel Hilton) belong to the Book a Hotel module, which has not
 * shipped, so they are not faked here. A restaurant without a map pin has no
 * distance, and the card leaves it out rather than printing "0.0 km".
 */
export function PopularNearYouSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, isLoading } = useMerchants();

  const open = (merchantId: string) =>
    navigation.navigate('Food', { screen: 'Restaurant', params: { merchantId } });

  const merchants = data ?? [];
  // Open places first, then by rating (the list's own order).
  const [hero, ...tiles] = [...merchants].sort((a, b) => Number(b.isOpen) - Number(a.isOpen));

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Popular Near You"
        size="lg"
        onSeeAll={() =>
          navigation.navigate('Food', { screen: 'Featured', params: { title: 'Popular Near You' } })
        }
      />

      {isLoading ? (
        <>
          <Skeleton height={140} borderRadius={radius['3xl']} />
          <View style={styles.row}>
            <Skeleton height={200} borderRadius={radius['3xl']} style={styles.flex} />
            <Skeleton height={200} borderRadius={radius['3xl']} style={styles.flex} />
          </View>
        </>
      ) : !hero ? (
        <EmptyState
          title="Nothing nearby yet"
          message="Restaurants will appear here as they join A-Z Globe."
        />
      ) : (
        <>
          <PlaceCard
            size="hero"
            name={hero.name}
            category={hero.tagline}
            image={hero.coverImage}
            rating={hero.rating}
            reviewCount={hero.reviewCount}
            distanceKm={hero.distanceKm}
            isOpen={hero.isOpen}
            onPress={() => open(hero.id)}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={styles.row}>
            {tiles.map((m) => (
              <PlaceCard
                key={m.id}
                style={styles.tile}
                name={m.name}
                category={m.tagline}
                image={m.coverImage}
                rating={m.rating}
                reviewCount={m.reviewCount}
                distanceKm={m.distanceKm}
                isOpen={m.isOpen}
                onPress={() => open(m.id)}
              />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing[5],
  },
  row: { flexDirection: 'row', gap: spacing[4] },
  carousel: { height: 200, flexGrow: 0 },
  tile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: 160 },
  flex: { flex: 1 },
});
