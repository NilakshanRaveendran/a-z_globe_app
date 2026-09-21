import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { Icon, Screen, Text } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import { isFirebaseReady } from '@core/firebase';
import type { Merchant, Order } from '@modules/food/types';
import { modules } from '@modules/registry';
import { useSession } from '@app/providers/SessionProvider';
import { useAuthActions } from '@app/auth/useAuthActions';
import type { RootStackParamList } from '@app/navigation/types';
import { listOwnedRestaurants } from '../services/restaurants';
import { listMerchantOrders } from '../services/orders';
import { StatCards } from '../components/StatCards';

/**
 * Provider dashboard — Figma 385:3033.
 *
 * Deliberately NOT a list of restaurants. Figma's provider home is a SERVICES
 * hub: the same six A-Z modules the customer sees on Home, seen from the other
 * side — the ones this account operates under "Active Services", the rest under
 * "Available to Activate". Restaurants live one level down, behind Restaurant
 * Management, because a provider may run a hotel and a cab fleet too.
 *
 *   header   location row · avatar · "<name>'s Dashboard" 700 24/36 ·
 *            "Manage your services in here." 500 14/21 #6B7280 · 1px rule
 *   stats    three cards — Orders Today · Revenue · Avg Rating
 *   eyebrow  "Active Services" / "Available to Activate" 700 11/16.5 ls0.55
 *   active   r16 #FFFFFF · 0.51px #D42B2B@18% · shadow 0 1 3 8% ·
 *            52pt r12 icon well · title 700 14/21 · business 600 11/16.5
 *            #D42B2B · tagline 400 10/15 · 5pt dot + "Active · …" ·
 *            sub-row 48h pad 14/16 with a chevron
 *   inactive one r16 card · title 600 14/21 #9CA3AF ·
 *            "Tap toggle to activate" 400 11/16.5 #D1D5DB · 44x24 toggle
 *
 * The module list comes from `modules/registry.ts`, so a module shipped for
 * customers appears here automatically.
 */
/**
 * "Vanan's Dashboard" (Figma) for a person; "Mamas Kitchen's Dashboard" for a
 * business. Uses the FULL account name, not the first word — a business name is
 * not a first name, and truncating "Mamas Kitchen" to "Mamas" then adding "'s"
 * produced "Mamas's". Names already ending in s take a bare apostrophe.
 */
function possessive(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function SupplierDashboardScreen() {
  const { user, location } = useSession();
  const { signOut } = useAuthActions();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [restaurants, setRestaurants] = useState<Merchant[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    if (!isFirebaseReady()) {
      setRestaurants([]);
      return;
    }
    const owned = await listOwnedRestaurants(user.uid).catch(() => []);
    setRestaurants(owned);
    // Today's numbers span every restaurant this account runs.
    const perShop = await Promise.all(owned.map((m) => listMerchantOrders(m.id).catch(() => [])));
    setOrders(perShop.flat());
  }, [user.uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const today = orders.filter((o) => (o.createdAt ?? 0) >= startOfToday());
  const revenue = today
    .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum, o) => sum + (o.pricing?.total ?? 0), 0);
  const rated = (restaurants ?? []).filter((m) => m.reviewCount > 0);
  const avgRating = rated.length
    ? (rated.reduce((s, m) => s + m.rating, 0) / rated.length).toFixed(1)
    : '—';

  const food = modules.find((m) => m.id === 'food');
  const others = modules.filter((m) => m.id !== 'food');
  const primary = restaurants?.[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.locationRow}>
              <Icon name="mapPin" size={14} color={colors.primary} />
              <Text variant="bodySm" color={colors.textSecondary}>
                {location}
              </Text>
              <Icon name="chevronRight" size={12} color={colors.textSecondary} />
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={signOut}
                hitSlop={8}
                style={styles.signOut}
              >
                <Text variant="captionBold" color={colors.textSecondary}>
                  Sign out
                </Text>
              </Pressable>
              <View style={styles.avatar}>
                <Text variant="h2" color={colors.onPrimary}>
                  {user.initial}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerText}>
            <Text variant="display" color={colors.text}>
              {possessive(user.fullName)} Dashboard
            </Text>
            <Text variant="bodyLg" color={colors.textSecondary}>
              Manage your services in here.
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <StatCards
            items={[
              { value: String(today.length), label: 'Orders Today', tint: '#FFF0F0' },
              { value: formatMoney(revenue), label: 'Revenue', tint: '#F0F4FF' },
              { value: avgRating, label: 'Avg Rating', tint: '#FFFBEB' },
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text variant="h3" color={colors.text}>
            Your Services
          </Text>

          <Text variant="eyebrow" color={colors.textMuted} style={styles.eyebrow}>
            Active Services
          </Text>

          {food ? (
            <View style={styles.activeCard}>
              <View style={styles.activeTop}>
                <View style={styles.serviceIcon}>
                  <Image source={food.icon} style={styles.serviceImage} contentFit="contain" />
                </View>
                <View style={styles.activeText}>
                  <Text variant="labelLg" color={colors.text}>
                    {food.title}
                  </Text>
                  {primary ? (
                    <Text variant="labelSm" color={colors.primary} numberOfLines={1}>
                      {primary.name}
                    </Text>
                  ) : null}
                  {primary?.tagline || primary?.cuisines.length ? (
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                      {primary?.tagline || primary?.cuisines.join(' ')}
                    </Text>
                  ) : null}
                  <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text variant="labelSm" color={colors.primary}>
                      Active · {restaurants?.length ?? 0} restaurant
                      {restaurants?.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.toggle, styles.toggleOn]}>
                  <View style={[styles.knob, styles.knobOn]} />
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('SupplierRestaurants')}
                style={styles.subRow}
              >
                <Text variant="body" color={colors.palette.gray700}>
                  Restaurant Management
                </Text>
                <Icon name="chevronRight" size={12} color={colors.borderStrong} />
              </Pressable>
            </View>
          ) : null}

          <Text variant="eyebrow" color={colors.textMuted} style={styles.eyebrowGap}>
            Available to Activate
          </Text>

          <View style={styles.inactiveCard}>
            {others.map((m, i) => (
              <View
                key={m.id}
                style={[styles.inactiveRow, i === others.length - 1 && styles.rowLast]}
              >
                <View style={[styles.serviceIcon, styles.serviceIconSm]}>
                  <Image source={m.icon} style={styles.serviceImage} contentFit="contain" />
                </View>
                <View style={styles.activeText}>
                  <Text variant="labelLg" color={colors.textMuted}>
                    {m.title}
                  </Text>
                  <Text variant="microRegular" color={colors.borderStrong}>
                    Tap toggle to activate
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: false }}
                  accessibilityLabel={`${m.title} — not available yet`}
                  onPress={() => navigation.navigate('ComingSoon', { title: m.title })}
                  style={styles.toggle}
                >
                  <View style={styles.knob} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[12] },
  header: { backgroundColor: colors.surface },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3.5],
    paddingHorizontal: SCREEN_PADDING,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5] },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  signOut: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    paddingTop: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stats: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[6] },
  section: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[6] },
  eyebrow: { marginTop: spacing[4], paddingHorizontal: spacing[1.5] },
  eyebrowGap: { marginTop: spacing[8], paddingHorizontal: spacing[1.5] },
  activeCard: {
    marginTop: spacing[3],
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(212,43,43,0.18)',
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.08), 0px 1px 2px -1px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
  },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconSm: { width: 44, height: 44 },
  serviceImage: { width: '70%', height: '70%' },
  activeText: { flex: 1 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    marginTop: spacing[0.5],
  },
  statusDot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.primary },
  subRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[6],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  inactiveCard: {
    marginTop: spacing[3],
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px -1px rgba(0,0,0,0.10)',
    overflow: 'hidden',
  },
  inactiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  rowLast: { borderBottomWidth: 0 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.primary },
  knob: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginLeft: 3,
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px -1px rgba(0,0,0,0.10)',
  },
  knobOn: { marginLeft: 23 },
});
