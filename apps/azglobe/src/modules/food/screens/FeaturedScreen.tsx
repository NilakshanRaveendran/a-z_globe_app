import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Screen, Text } from '@core/ui';
import { Skeleton } from '@core/ui/Skeleton';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { FeaturedListRow } from '../components/FeaturedListRow';
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
            {params?.title ?? 'Featured on A-Z Globe'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8}>
          <Icon name="bell" size={22} color={colors.palette.ink} />
        </Pressable>
      </View>

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
        />
      )}
    </Screen>
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
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flex: 1 },
  headerTitle: { fontSize: 22, lineHeight: 33 },
  list: { paddingBottom: spacing[9] },
  loading: { paddingHorizontal: SCREEN_PADDING, gap: spacing[6] },
  loadingRow: { gap: spacing[3] },
});
