import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { colors, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, Text, type IconName } from '@core/ui';
import type { Merchant, Order } from '@modules/food/types';
import type { RootStackParamList } from '@app/navigation/types';
import { getOwnedRestaurant } from '../services/restaurants';
import { ACTIVE_STATUSES, listMerchantOrders } from '../services/orders';
import { averageRating, businessStats, loadRatings, StatCards } from '../components/StatCards';
import { SupplierPageHeader } from '../components/SupplierPageHeader';
import { useRestaurantControls } from '../components/useRestaurantControls';

/**
 * Restaurant hub — Figma 385:5072.
 *
 *   header   SupplierPageHeader — back · restaurant name 700 24/36 #D42B2B ·
 *            "Sri Lankan · Authentic" 400 12/18 #6B7280
 *   stats    three cards — Orders Today · Revenue · Avg Rating (StatCards)
 *   alert    r14 #FFF0F0 · 0.52px #D42B2B@20% · pad 12 · gap 10 · 36pt
 *            #D42B2B circle with an 18pt white ⚠ · "N Active Orders
 *            Awaiting" 700 13/19.5 #D42B2B
 *   eyebrow  MANAGE RESTAURANT 700 11/16.5 ls0.55 #9CA3AF uppercase, inset 4
 *   card     r16 #FFFFFF · 0.51px #E5E7EB · shadow 0 1 3 6%, holding six rows
 *   row      pad 14/16 · gap 14 · 0.51px #F3F4F6 rule · 40pt r12 #FFF0F0
 *            well with a 20pt #D42B2B glyph · title 600 14/21 · sub 400
 *            11/16.5 #9CA3AF · 7x12 chevron #D1D5DB
 *
 * Every section below the header sits 12 below the previous one with 16 of
 * top padding (Figma's gap-12 column of pt-16 containers).
 *
 * The frame has nothing right of the back button; that is where the owner
 * opens and closes the restaurant, since the hub is where they work:
 *
 *   switch   pill pad 4/4/4/10 · r∞ · #F0FDF4 open / #F3F4F6 closed · 6pt
 *            dot #4ADE80 / #D1D5DB · 600 12/18 #16A34A / #6B7280 · the
 *            offers' 40×22 toggle (16pt knob inset 3) — same checks as the ⋮
 *            menu on Restaurant Management (useRestaurantControls)
 */
type Area = {
  icon: IconName;
  title: string;
  subtitle: string;
  route:
    | 'SupplierMenu'
    | 'SupplierOrders'
    | 'SupplierOrderHistory'
    | 'SupplierOffers'
    | 'SupplierReviews'
    | 'SupplierRestaurantInfo';
};

const AREAS: Area[] = [
  {
    icon: 'menuManagement',
    title: 'Menu Management',
    subtitle: 'Manage dishes, categories, prices and availability',
    route: 'SupplierMenu',
  },
  {
    icon: 'activeOrders',
    title: 'Active Orders',
    subtitle: 'View and process current orders',
    route: 'SupplierOrders',
  },
  {
    icon: 'orderHistory',
    title: 'Order History',
    subtitle: 'View completed and cancelled orders',
    route: 'SupplierOrderHistory',
  },
  {
    icon: 'offers',
    title: 'Offers & Discounts',
    subtitle: 'Create and manage restaurant promotions',
    route: 'SupplierOffers',
  },
  {
    icon: 'reviews',
    title: 'Reviews',
    subtitle: 'View and reply to customer reviews',
    route: 'SupplierReviews',
  },
  {
    icon: 'restaurantInfo',
    title: 'Restaurant Information',
    subtitle: 'Manage profile, location, hours and contact',
    route: 'SupplierRestaurantInfo',
  },
];

export function RestaurantHubScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierRestaurantHub'>>();
  const { merchantId } = params;

  // undefined while the first read is in flight; null once it found nothing.
  const [merchant, setMerchant] = useState<Merchant | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rating, setRating] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [m, o] = await Promise.all([
      getOwnedRestaurant(merchantId).catch(() => null),
      listMerchantOrders(merchantId).catch(() => []),
    ]);
    setMerchant(m);
    setOrders(o);
    setRating(m ? averageRating((await loadRatings([m])).values()) : null);
  }, [merchantId]);

  const controls = useRestaurantControls({
    onChanged: () => void load(),
    onArchived: () => navigation.goBack(),
  });

  // Reload on focus: the numbers here go stale as soon as an order is accepted
  // on the Active Orders screen this navigates to.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const awaiting = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;

  const subtitle = merchant?.cuisines?.length ? merchant.cuisines.join(' · ') : merchant?.tagline ?? '';

  // Every destination titles itself with the restaurant's name, so nothing is
  // opened until the restaurant has loaded — otherwise a quick tap landed on
  // "Manage your  menu" with the name missing.
  const open = (route: Area['route']) => {
    if (!merchant) return;
    if (route === 'SupplierRestaurantInfo') {
      navigation.navigate('SupplierRestaurantInfo', { merchantId });
      return;
    }
    // The other five share one params shape; TS cannot pick an overload for a
    // union of route names, so name one of them.
    navigation.navigate(route as 'SupplierMenu', { merchantId, merchantName: merchant.name });
  };

  if (merchant === null) {
    return (
      <Screen>
        <SupplierPageHeader title="Restaurant" onBack={() => navigation.goBack()} />
        <View style={styles.missing}>
          <EmptyState
            title="Restaurant not found"
            message="It may have been removed. Go back to Restaurant Management and try again."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <SupplierPageHeader
        // A space keeps the 36pt title line while the name loads.
        title={merchant?.name ?? ' '}
        titleColor={colors.primary}
        subtitle={
          subtitle ? (
            <Text variant="bodyRegular" color={colors.textSecondary}>
              {subtitle}
            </Text>
          ) : undefined
        }
        onBack={() => navigation.goBack()}
        action={
          merchant ? (
            <OpenSwitch
              open={merchant.isOpen}
              busy={controls.busyId === merchant.id}
              name={merchant.name}
              onPress={() => void controls.toggleOpen(merchant)}
            />
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <StatCards
            items={businessStats({ orders, rating })}
          />
        </View>

        {awaiting > 0 ? (
          <View style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !merchant }}
              disabled={!merchant}
              onPress={() => open('SupplierOrders')}
              style={({ pressed }) => [styles.alert, pressed && styles.pressed]}
            >
              <View style={styles.alertIcon}>
                <Icon name="warning" size={18} color={colors.onPrimary} />
              </View>
              <Text variant="price" color={colors.primary} style={styles.flex}>
                {awaiting} Active Order{awaiting === 1 ? '' : 's'} Awaiting
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="eyebrow" color={colors.textMuted} style={styles.eyebrow}>
            Manage Restaurant
          </Text>

          <View style={styles.card}>
            {AREAS.map((area, i) => (
              <Pressable
                key={area.title}
                accessibilityRole="button"
                accessibilityState={{ disabled: !merchant }}
                disabled={!merchant}
                onPress={() => open(area.route)}
                style={({ pressed }) => [
                  styles.row,
                  i === AREAS.length - 1 && styles.rowLast,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.well}>
                  <Icon name={area.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text variant="labelLg" color={colors.text} numberOfLines={1}>
                    {area.title}
                  </Text>
                  <Text variant="microRegular" color={colors.textMuted} numberOfLines={2}>
                    {area.subtitle}
                  </Text>
                </View>
                <Icon name="chevronRight" size={12} color={colors.borderStrong} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Open/Closed for orders, in the hub header. */
function OpenSwitch({
  open,
  busy,
  name,
  onPress,
}: {
  open: boolean;
  busy: boolean;
  name: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${name} open for orders`}
      accessibilityState={{ checked: open, busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.openSwitch,
        open ? styles.openSwitchOn : styles.openSwitchOff,
        (pressed || busy) && styles.pressed,
      ]}
    >
      <View style={[styles.openDot, !open && styles.openDotOff]} />
      <Text variant="label" color={open ? colors.palette.green600 : colors.textSecondary}>
        {open ? 'Open' : 'Closed'}
      </Text>
      <View style={[styles.toggle, open ? styles.toggleOn : styles.toggleOff]}>
        <View style={[styles.knob, open && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  openSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingVertical: spacing[1.5],
    paddingLeft: spacing[3.5],
    paddingRight: spacing[1.5],
    borderRadius: radius.pill,
  },
  openSwitchOn: { backgroundColor: colors.palette.green25 },
  openSwitchOff: { backgroundColor: colors.surfaceAlt },
  openDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.palette.green400 },
  openDotOff: { backgroundColor: colors.borderStrong },
  toggle: { width: 40, height: 22, borderRadius: radius.pill, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.primary },
  toggleOff: { backgroundColor: colors.borderStrong },
  knob: {
    width: 16,
    height: 16,
    marginLeft: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.toggleKnob,
  },
  knobOn: { marginLeft: 21 },
  pressed: { opacity: 0.8 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[12] },
  missing: { marginTop: spacing[9], paddingHorizontal: SCREEN_PADDING },
  section: { marginTop: spacing[4], paddingTop: spacing[6] },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3.5],
    padding: spacing[4],
    borderRadius: radius['2xl'],
    borderWidth: 0.52,
    borderColor: colors.primaryOutlineStrong,
    backgroundColor: colors.primaryTint,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { paddingHorizontal: spacing[1.5], textTransform: 'uppercase' },
  card: {
    marginTop: spacing[3],
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 0.51,
    borderColor: colors.border,
    ...shadows.sectionCard,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[6],
    borderBottomWidth: 0.51,
    borderBottomColor: colors.surfaceAlt,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: colors.surfaceSunken },
  well: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
