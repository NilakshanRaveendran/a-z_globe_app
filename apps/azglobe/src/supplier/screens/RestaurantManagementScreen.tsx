import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFocusEffect,
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import { colors, gradients, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, ScreenHeader, Skeleton, Text } from '@core/ui';
import type { Merchant } from '@modules/food/types';
import { resolveImage } from '@modules/food/data/images';
import { useSession } from '@app/providers/SessionProvider';
import type { RootStackParamList } from '@app/navigation/types';
import { AddRestaurantSheet } from './AddRestaurantSheet';
import { listOwnedRestaurants } from '../services/restaurants';

/**
 * Restaurant Management — Figma 385:3424.
 *
 *   title   "Restaurant Management" Urbanist 700 24/36 ·
 *           "Manage your restaurants and food services." 500 13/19.5 #6B7280
 *   meta    "N restaurants · N open now"
 *   card    361x249 · r20 · #FFFFFF · 0.51px #E5E7EB · shadow 0 1 4 8%
 *             cover  90h with a bottom-up scrim, "Open" pill on #FFFFFF@20%
 *                    with a 5pt #4ADE80 dot, 30pt blurred round button
 *             body   pad 16/16/14 · name 700 15/22.5 · cuisines 400 12/18 ·
 *                    44pt r14 avatar · rating row ·
 *                    "Manage Restaurant" 42h r12 #D42B2B 700 13/19.5
 *   cta     "Add Restaurant" 700 12/18 #FFFFFF
 */
export function RestaurantManagementScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useSession();
  const [restaurants, setRestaurants] = useState<Merchant[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setRestaurants(await listOwnedRestaurants(user.uid));
    } catch {
      setRestaurants([]);
    }
  }, [user.uid]);

  // Reload on focus so a rename or an open/closed change made deeper in the
  // stack is reflected when the user comes back.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openNow = (restaurants ?? []).filter((m) => m.isOpen).length;

  return (
    <Screen>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="display" color={colors.text}>
          Restaurant Management
        </Text>
        <Text variant="body" color={colors.textSecondary}>
          Manage your restaurants and food services.
        </Text>

        {restaurants?.length ? (
          <View style={styles.metaRow}>
            <Text variant="h5" color={colors.text}>
              {restaurants.length}
            </Text>
            <Text variant="bodySm" color={colors.textSecondary}>
              restaurant{restaurants.length === 1 ? '' : 's'}
            </Text>
            <Text variant="bodyLg" color={colors.border}>
              ·
            </Text>
            <Text variant="bodySm" color={colors.textSecondary}>
              {openNow} open now
            </Text>
          </View>
        ) : null}

        {restaurants === null ? (
          <View style={styles.list}>
            <Skeleton height={249} />
          </View>
        ) : restaurants.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              title="No restaurants yet"
              message="Add your first restaurant and it will appear for customers on A-Z Globe."
            />
          </View>
        ) : (
          <View style={styles.list}>
            {restaurants.map((m) => (
              <View key={m.id} style={styles.card}>
                <View style={styles.cover}>
                  {m.coverImage ? (
                    <Image
                      source={resolveImage(m.coverImage)}
                      style={styles.coverImage}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <LinearGradient
                      colors={[colors.primary, '#FF8A65']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.coverImage}
                    />
                  )}
                  <LinearGradient
                    colors={gradients.imageScrimSoft}
                    style={styles.scrim}
                    pointerEvents="none"
                  />
                  <View style={styles.openPill}>
                    <View
                      style={[
                        styles.openDot,
                        { backgroundColor: m.isOpen ? '#4ADE80' : colors.borderStrong },
                      ]}
                    />
                    <Text variant="captionBold" color={colors.onPrimary}>
                      {m.isOpen ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                </View>

                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <View style={styles.titleText}>
                      <Text variant="h4" color={colors.text} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text variant="bodyRegular" color={colors.textSecondary} numberOfLines={1}>
                        {m.cuisines.length ? m.cuisines.join(' · ') : 'No cuisine set'}
                      </Text>
                    </View>
                    <View style={styles.avatar}>
                      <Text variant="h4" color={colors.onPrimary}>
                        {m.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ratingRow}>
                    <Icon name="star" size={12} color={colors.star} />
                    <Text variant="label" color={colors.text}>
                      {m.reviewCount ? m.rating.toFixed(1) : '—'}
                    </Text>
                    <Text variant="microRegular" color={colors.textMuted}>
                      {m.reviewCount ? `(${m.reviewCount} Reviews)` : '(No reviews yet)'}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('SupplierRestaurantHub', { merchantId: m.id })
                    }
                    style={styles.manageBtn}
                  >
                    <Icon name="store" size={14} color={colors.onPrimary} />
                    <Text variant="price" color={colors.onPrimary}>
                      Manage Restaurant
                    </Text>
                    <Icon name="chevronRight" size={14} color={colors.onPrimary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => setAdding(true)}
          style={styles.addBtn}
        >
          <Icon name="plusSm" size={14} color={colors.onPrimary} />
          <Text variant="labelSm" color={colors.onPrimary}>
            Add Restaurant
          </Text>
        </Pressable>
      </ScrollView>

      <AddRestaurantSheet
        visible={adding}
        supplierUid={user.uid}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          void load();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[12], gap: spacing[1.5] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], marginTop: spacing[4] },
  list: { gap: spacing[6], marginTop: spacing[6] },
  empty: { marginTop: spacing[9] },
  card: {
    borderRadius: radius['4xl'],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 1px 4px 0px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  cover: { height: 90, justifyContent: 'flex-end' },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  openPill: {
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  openDot: { width: 5, height: 5, borderRadius: radius.pill },
  body: { paddingHorizontal: spacing[6], paddingTop: spacing[6], paddingBottom: spacing[5] },
  titleRow: { flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between' },
  titleText: { flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px -1px rgba(0,0,0,0.10)',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2.5],
  },
  manageBtn: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2.5],
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    marginTop: spacing[4],
  },
  addBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    marginTop: spacing[6],
  },
});
