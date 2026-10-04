import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFocusEffect,
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import { colors, gradients, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, Text, showToast } from '@core/ui';
import type { Merchant } from '@modules/food/types';
import { resolveImage } from '@modules/food/data/images';
import { useSession } from '@app/providers/SessionProvider';
import type { RootStackParamList } from '@app/navigation/types';
import { AddRestaurantSheet } from './AddRestaurantSheet';
import { SupplierHeaderAction, SupplierPageHeader } from '../components/SupplierPageHeader';
import { listOwnedRestaurants } from '../services/restaurants';
import { ActionMenu, measureAnchor, type MenuAnchor } from '../components/ActionMenu';
import { useRestaurantControls } from '../components/useRestaurantControls';
import type { RatingSummary } from '../services/reviews';
import { loadRatings } from '../components/StatCards';
import { initials } from '@core/utils/text';

/**
 * Restaurant Management — Figma 385:3424 (header 385:3425).
 *
 *   header  SupplierPageHeader — back · "+ Add Restaurant" · "Restaurant
 *           Management" 700 24/36 · "Manage your restaurants and food
 *           services." 500 13/19.5 #6B7280
 *   strip   #FFFFFF · 0.51px #F3F4F6 rule · pad 10/16 · gap 12 ·
 *           "2" 700 14/21 + "restaurants" 500 12/18 #6B7280 · "·" #E5E7EB ·
 *           6pt #4ADE80 dot + "2 open now" 500 12/18 #6B7280
 *   list    pad 16/16/32 · gap 16
 *   card    r20 · #FFFFFF · 0.51px #E5E7EB · shadow 0 1 4 8%
 *             cover  90h · photo (or the #D42B2B→#FF8A65 166° placeholder)
 *                    under a scrim that fades into the card body ·
 *                    "Open" pill 21h pad 3/8 r∞ #FFFFFF@20% with a 5pt
 *                    #4ADE80 dot, 600 10/15 white, at 12/15 ·
 *                    30pt frosted ⋮ button at top 8 / right 10
 *             body   pad 16/16/14 · name 700 15/22.5 · cuisines 400 12/18
 *                    #6B7280 · 44pt r14 logo tile, 2px white ring ·
 *                    rating row +6: 12pt star, 600 12/18, "(N Reviews)"
 *                    400 11/16.5 #9CA3AF · "Manage Restaurant" +12: 42h r12
 *                    #D42B2B, clock + 700 13/19.5 white + chevron, gap 6
 *
 * A restaurant is created closed (see createRestaurant). The ⋮ popover is
 * where a supplier opens it for orders (once it has a dish and valid hours),
 * closes it again (confirmed, naming its active orders) or archives it
 * (refused while orders are active) — see useRestaurantControls.
 *
 * Creating a restaurant goes straight into its hub, with a toast pointing at
 * the next step: the menu.
 */
export function RestaurantManagementScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, isDemo } = useSession();
  const [restaurants, setRestaurants] = useState<Merchant[] | null>(null);
  const [ratings, setRatings] = useState<Map<string, RatingSummary>>(new Map());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    let owned: Merchant[] = [];
    try {
      owned = await listOwnedRestaurants(user.uid);
    } catch {
      // Falls through to the empty state.
    }
    setRestaurants(owned);
    setRatings(await loadRatings(owned));
  }, [user.uid]);

  // Reload on focus so a rename or an open/closed change made deeper in the
  // stack is reflected when the user comes back.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const controls = useRestaurantControls({ onChanged: () => void load() });
  const [menu, setMenu] = useState<{ merchant: Merchant; anchor: MenuAnchor } | null>(null);

  const menuItems = (m: Merchant) => [
    m.isOpen
      ? { label: 'Close restaurant', icon: 'xCircle' as const, destructive: true, onPress: () => void controls.toggleOpen(m) }
      : { label: 'Open restaurant', icon: 'check' as const, onPress: () => void controls.toggleOpen(m) },
    {
      label: 'Restaurant information',
      icon: 'restaurantInfo' as const,
      onPress: () => navigation.navigate('SupplierRestaurantInfo', { merchantId: m.id }),
    },
    { label: 'Archive restaurant', icon: 'trash' as const, destructive: true, onPress: () => void controls.archive(m) },
  ];

  const onCreated = (merchantId: string, name: string) => {
    setAdding(false);
    void load();
    navigation.navigate('SupplierRestaurantHub', { merchantId });
    showToast(`${name} created · add your menu next`, {
      action: {
        label: 'Add menu',
        onPress: () => navigation.navigate('SupplierMenu', { merchantId, merchantName: name }),
      },
      duration: 6000,
    });
  };

  const openNow = (restaurants ?? []).filter((m) => m.isOpen).length;

  return (
    <Screen>
      <SupplierPageHeader
        title="Restaurant Management"
        subtitle="Manage your restaurants and food services."
        onBack={() => navigation.goBack()}
        action={<SupplierHeaderAction label="Add Restaurant" onPress={() => setAdding(true)} />}
      />

      {restaurants?.length ? (
        <View style={styles.strip}>
          <View style={styles.stripGroup}>
            <Text variant="h5" color={colors.text}>
              {restaurants.length}
            </Text>
            <Text variant="bodySm" color={colors.textSecondary}>
              restaurant{restaurants.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Text variant="h3" color={colors.border}>
            ·
          </Text>
          <View style={[styles.stripGroup, styles.stripGroupTight]}>
            <View style={[styles.stripDot, !openNow && styles.dotClosed]} />
            <Text variant="bodySm" color={colors.textSecondary}>
              {openNow} open now
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {restaurants === null ? (
          <Skeleton height={245} />
        ) : restaurants.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              icon="store"
              title="No restaurants yet"
              message={
                isDemo
                  ? 'No restaurants saved on this device yet. Add one to try the business tools.'
                  : 'Add your first restaurant and it will appear for customers on A-Z Globe.'
              }
              actionLabel="Add Restaurant"
              onAction={() => setAdding(true)}
            />
          </View>
        ) : (
          restaurants.map((m) => {
            const rating = ratings.get(m.id);
            return (
              <View key={m.id} style={styles.card}>
                <View style={styles.cover}>
                  {m.coverImage ? (
                    <Image
                      source={resolveImage(m.coverImage)}
                      style={styles.fill}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <LinearGradient
                      colors={gradients.restaurantCover}
                      // CSS 166° across a 361x90 box, in unit coordinates.
                      start={{ x: 0.44, y: -0.44 }}
                      end={{ x: 0.56, y: 1.44 }}
                      style={styles.fill}
                    />
                  )}
                  {m.coverImage ? (
                    <LinearGradient
                      colors={gradients.restaurantCoverFade}
                      locations={gradients.restaurantCoverFadeStops}
                      style={styles.fill}
                      pointerEvents="none"
                    />
                  ) : null}
                  <View style={styles.openPill}>
                    <View style={[styles.openDot, !m.isOpen && styles.dotClosed]} />
                    <Text variant="captionBold" color={colors.onPrimary}>
                      {m.isOpen ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                  <MoreButton
                    label={`${m.name} options`}
                    busy={controls.busyId === m.id}
                    onOpen={(anchor) => setMenu({ merchant: m, anchor })}
                  />
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
                    <View style={styles.logo}>
                      <Text variant="h4" color={colors.onPrimary}>
                        {initials(m.name, 1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ratingRow}>
                    <Icon name="star" size={16} color={colors.star} />
                    <Text variant="label" color={colors.text}>
                      {rating?.total ? rating.average.toFixed(1) : '—'}
                    </Text>
                    <Text variant="microRegular" color={colors.textMuted}>
                      {rating?.total
                        ? `(${rating.total} Review${rating.total === 1 ? '' : 's'})`
                        : '(No reviews yet)'}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Manage ${m.name}`}
                    onPress={() => navigation.navigate('SupplierRestaurantHub', { merchantId: m.id })}
                    style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
                  >
                    <Icon name="clock" size={14} color={colors.onPrimary} />
                    <Text variant="price" color={colors.onPrimary}>
                      Manage Restaurant
                    </Text>
                    <Icon name="chevronRight" size={14} color={colors.onPrimary} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <AddRestaurantSheet
        visible={adding}
        supplierUid={user.uid}
        onClose={() => setAdding(false)}
        onCreated={onCreated}
      />

      <ActionMenu
        anchor={menu?.anchor ?? null}
        title={
          menu
            ? `${menu.merchant.name} · ${menu.merchant.isOpen ? 'Open — customers can order' : 'Closed — no new orders'}`
            : undefined
        }
        items={menu ? menuItems(menu.merchant) : []}
        onClose={() => setMenu(null)}
      />
    </Screen>
  );
}

/** The frosted ⋮ on a card's cover; measures itself so the popover opens under it. */
function MoreButton({ label, busy, onOpen }: { label: string; busy: boolean; onOpen: (anchor: MenuAnchor) => void }) {
  const ref = useRef<View>(null);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={() => measureAnchor(ref, onOpen)}
      hitSlop={8}
      style={({ pressed }) => [styles.moreBtn, (pressed || busy) && styles.pressed]}
    >
      <Icon name="moreVertical" size={16} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[3.5],
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.51,
    borderBottomColor: colors.surfaceAlt,
  },
  stripGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  stripGroupTight: { gap: spacing[1.5] },
  stripDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.palette.green400 },
  dotClosed: { backgroundColor: colors.borderStrong },

  content: {
    paddingTop: spacing[6],
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing[12],
    gap: spacing[6],
  },
  empty: { marginTop: spacing[9] },

  card: {
    borderRadius: radius['4xl'],
    backgroundColor: colors.surface,
    borderWidth: 0.51,
    borderColor: colors.border,
    ...shadows.listCard,
    overflow: 'hidden',
  },
  cover: { height: 90 },
  openPill: {
    position: 'absolute',
    top: 15,
    left: spacing[4],
    height: 21,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    backgroundColor: colors.glassFrost,
  },
  openDot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.palette.green400 },
  moreBtn: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3.5],
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.glassFrost,
    alignItems: 'center',
    justifyContent: 'center',
    // Figma also blurs the photo behind it (backdrop-blur 8). React Native
    // has no backdrop filter, so the 20% frost carries it alone.
  },

  body: { paddingTop: spacing[6], paddingHorizontal: spacing[6], paddingBottom: spacing[5] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  titleText: { flex: 1, minWidth: 0 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.tile,
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
});
