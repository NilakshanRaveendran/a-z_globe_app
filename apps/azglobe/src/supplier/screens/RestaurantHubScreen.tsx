import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { Icon, Screen, ScreenHeader, Text, type IconName } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import type { Merchant, Order } from '@modules/food/types';
import type { RootStackParamList } from '@app/navigation/types';
import { getOwnedRestaurant } from '../services/restaurants';
import { ACTIVE_STATUSES, listMerchantOrders } from '../services/orders';
import { StatCards } from '../components/StatCards';

/**
 * Restaurant hub — Figma 385:5072.
 *
 *   title    restaurant name Urbanist 700 24/36 #D42B2B ·
 *            "Sri Lankan · Authentic" Urbanist 400 12/18 #6B7280
 *   stats    three cards — Orders Today · Revenue · Avg Rating
 *   alert    "N Active Orders Awaiting" Urbanist 700 13/19.5 #D42B2B
 *   eyebrow  "Manage Restaurant" Urbanist 700 11/16.5 ls0.55 #9CA3AF
 *   card     r16 #FFFFFF · 0.51px #E5E7EB · shadow 0 1 3 6%, holding six rows
 *   row      68.5h · pad 14/16 · gap 14 · 1px #F3F4F6 rule ·
 *            40pt r12 #FFF0F0 icon well · title 600 14/21 · sub 400 11/16.5 ·
 *            7x12 chevron #D1D5DB
 *
 * The six areas are the whole provider surface for one restaurant. Three are
 * built; the rest announce themselves rather than silently doing nothing.
 */
type Area = {
  icon: IconName;
  title: string;
  subtitle: string;
  route?: keyof RootStackParamList;
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
  },
  {
    icon: 'restaurantInfo',
    title: 'Restaurant Information',
    subtitle: 'Manage profile, location, hours and contact',
    route: 'SupplierRestaurantInfo',
  },
];

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function RestaurantHubScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierRestaurantHub'>>();
  const { merchantId } = params;

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const [m, o] = await Promise.all([
      getOwnedRestaurant(merchantId).catch(() => null),
      listMerchantOrders(merchantId).catch(() => []),
    ]);
    setMerchant(m);
    setOrders(o);
  }, [merchantId]);

  // Reload on focus: the numbers here go stale as soon as an order is accepted
  // on the Active Orders screen this navigates to.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const today = orders.filter((o) => (o.createdAt ?? 0) >= startOfToday());
  const revenue = today
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum, o) => sum + (o.pricing?.total ?? 0), 0);
  const awaiting = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;

  const subtitle = merchant?.cuisines?.length ? merchant.cuisines.join(' · ') : '';

  return (
    <Screen>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="display" color={colors.primary}>
          {merchant?.name ?? ' '}
        </Text>
        {subtitle ? (
          <Text variant="bodyRegular" color={colors.textSecondary}>
            {subtitle}
          </Text>
        ) : null}

        <View style={styles.stats}>
          <StatCards
            items={[
              { value: String(today.length), label: 'Orders Today', tint: '#FFF0F0' },
              { value: formatMoney(revenue), label: 'Revenue', tint: '#F0F4FF' },
              {
                // A restaurant with no reviews has no average — showing 0.0
                // reads as a bad score rather than an absent one.
                value: merchant?.reviewCount ? merchant.rating.toFixed(1) : '—',
                label: 'Avg Rating',
                tint: '#FFFBEB',
              },
            ]}
          />
        </View>

        {awaiting > 0 ? (
          <View style={styles.alert}>
            <Text variant="price" color={colors.primary}>
              {awaiting} Active Order{awaiting === 1 ? '' : 's'} Awaiting
            </Text>
          </View>
        ) : null}

        <Text variant="eyebrow" color={colors.textMuted} style={styles.eyebrow}>
          Manage Restaurant
        </Text>

        <View style={styles.card}>
          {AREAS.map((area, i) => (
            <Pressable
              key={area.title}
              accessibilityRole="button"
              accessibilityState={{ disabled: !area.route }}
              onPress={() => {
                if (!area.route) return;
                navigation.navigate(area.route as 'SupplierMenu', {
                  merchantId,
                  merchantName: merchant?.name ?? '',
                });
              }}
              style={[styles.row, i === AREAS.length - 1 && styles.rowLast]}
            >
              <View style={styles.well}>
                <Icon name={area.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text variant="labelLg" color={colors.text}>
                  {area.title}
                </Text>
                <Text variant="microRegular" color={colors.textMuted}>
                  {area.route ? area.subtitle : `${area.subtitle} · coming soon`}
                </Text>
              </View>
              <Icon name="chevronRight" size={12} color={colors.borderStrong} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[12] },
  stats: { marginTop: spacing[6] },
  alert: { marginTop: spacing[6] },
  eyebrow: { marginTop: spacing[9], paddingHorizontal: spacing[1.5] },
  card: {
    marginTop: spacing[3],
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  row: {
    minHeight: 68.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  rowLast: { borderBottomWidth: 0 },
  well: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: spacing[0.5] },
});
