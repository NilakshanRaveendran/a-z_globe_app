import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
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
 */
export function PopularNearYouSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, isLoading } = useMerchants();

  const open = (merchantId: string) =>
    navigation.navigate('Food', { screen: 'Restaurant', params: { merchantId } });

  const merchants = data ?? [];
  const [hero, ...rest] = merchants;
  const tiles = rest.slice(0, 2);

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Popular Near You"
        size="lg"
        onSeeAll={() => navigation.navigate('Food', { screen: 'FoodLanding' })}
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
            distanceKm={hero.distanceKm ?? 0}
            isOpen={hero.isOpen}
            onPress={() => open(hero.id)}
          />
          <View style={styles.row}>
            {tiles.map((m) => (
              <PlaceCard
                key={m.id}
                name={m.name}
                category={m.tagline}
                image={m.coverImage}
                rating={m.rating}
                reviewCount={m.reviewCount}
                distanceKm={m.distanceKm ?? 0}
                isOpen={m.isOpen}
                onPress={() => open(m.id)}
              />
            ))}
          </View>
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
  flex: { flex: 1 },
});
