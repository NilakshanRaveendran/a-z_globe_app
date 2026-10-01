import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, View } from 'react-native';
import { EmptyState, Screen, ScreenHeader } from '@core/ui';
import { Skeleton } from '@core/ui/Skeleton';
import { radius, SCREEN_PADDING, spacing } from '@core/theme';
import { FeaturedListRow } from '../components/FeaturedListRow';
import { HeroActions } from '../components/HeroActions';
import { useMerchants } from '../hooks/queries';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * "Featured on A-Z Globe" list — Figma 16:4256.
 *
 * Header matches the Order Food landing page (back chevron + 22/33 title, bell
 * on the right), then a vertical list of FeaturedListRows.
 */
export function FeaturedScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'Featured'>>();
  const { data, isLoading } = useMerchants();

  const merchants = data ?? [];

  return (
    <Screen>
      <ScreenHeader
        title={params?.title ?? 'Featured on A-Z Globe'}
        onBack={navigation.goBack}
        action={<HeroActions />}
      />

      {isLoading ? (
        <View style={styles.loading}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.loadingRow}>
              <Skeleton height={200} borderRadius={radius['3xl']} />
              <Skeleton width="45%" height={20} />
              <Skeleton width="65%" height={14} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={merchants}
          keyExtractor={(m) => m.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <FeaturedListRow
              merchant={item}
              showDivider={index < merchants.length - 1}
              onPress={() => navigation.navigate('Restaurant', { merchantId: item.id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="store"
              title="No restaurants yet"
              message="Restaurants will appear here as they join A-Z Globe."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing[9] },
  loading: { paddingHorizontal: SCREEN_PADDING, gap: spacing[6] },
  loadingRow: { gap: spacing[3] },
});
