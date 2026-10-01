import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { Icon, Screen, Text, HeaderButton } from '@core/ui';
import { Alert } from '@core/ui/alert';
import type { Merchant, Order } from '@modules/food/types';
import { modules } from '@modules/registry';
import { useSession } from '@app/providers/SessionProvider';
import type { RootStackParamList } from '@app/navigation/types';
import { listOwnedRestaurants } from '../services/restaurants';
import { ACTIVE_STATUSES, listMerchantOrders } from '../services/orders';
import { averageRating, businessStats, loadRatings, StatCards } from '../components/StatCards';

/**
 * Provider dashboard — Figma 385:3033.
 *
 * Deliberately NOT a list of restaurants. Figma's provider home is a SERVICES
 * hub: the same six A-Z modules the customer sees on Home, seen from the other
 * side — the ones this account operates under "Active Services", the rest under
 * "Available to Activate". Restaurants live one level down, behind Restaurant
 * Management, because a provider may run a hotel and a cab fleet too.
 *
 *   top      pad 10/16 · 14pt pin + location 500 12/18 #6B7280 + 13pt ⌄ ·
 *            40pt #F3F4F6 bell with an 8pt #FB2C36 dot · 40pt red avatar
 *   title    "Business Dashboard" 700 24/36 — always, not "<name>'s Dashboard"
 *            as Figma has it, since a business account isn't one person · "Manage your services in here."
 *            500 14/21 #6B7280 · pad 12/16/16.5 · 0.54px #E5E7EB rule
 *   stats    three cards — Orders Today · Revenue · Avg Rating (StatCards)
 *   heading  "Your Services" 700 16/24
 *   eyebrow  ACTIVE SERVICES / AVAILABLE TO ACTIVATE 700 11/16.5 ls0.55
 *            #9CA3AF uppercase, inset 4
 *   active   r16 #FFFFFF · 0.51px #D42B2B@18% · shadow 0 1 3 8% · pad 12/16 ·
 *            gap 12 · 52pt r12 image · title 700 14/21 · restaurant 600
 *            11/16.5 #D42B2B · tagline 400 10/15 #9CA3AF · 5pt dot +
 *            "Active · N options" 500 11/16.5 #D42B2B · then, gap 6: 28pt
 *            #F3F4F6 pencil button, 44x24 #D42B2B toggle, 28pt chevron button
 *   inactive one r16 card · 0.54px #E5E7EB · rows pad 12/16 · image @45% ·
 *            title 600 14/21 #9CA3AF · "Tap toggle to activate" 400 11/16.5
 *            #D1D5DB · 44x24 #D1D5DB toggle
 *
 * The module list comes from `modules/registry.ts`, so a module shipped for
 * customers appears here automatically.
 *
 * Behaviour the frame only implies:
 *   - the bell's dot means orders are waiting; the bell then opens the Orders
 *     tab. With nothing waiting it has no dot and explains notifications.
 *   - the location opens where the address is edited: the restaurant's
 *     information, or Restaurant Management when there are several.
 *   - with two or more restaurants the card names "N restaurants" and the
 *     pencil opens Restaurant Management rather than editing only the first.
 *   - below 360pt the three controls drop under the text, which otherwise
 *     wraps to "Order / Food".
 */

export function SupplierDashboardScreen() {
  const { user, location } = useSession();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const narrow = width < 360;

  const [restaurants, setRestaurants] = useState<Merchant[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const load = useCallback(async () => {
    const owned = await listOwnedRestaurants(user.uid).catch(() => []);
    setRestaurants(owned);
    // Today's numbers span every restaurant this account runs.
    const [perShop, ratings] = await Promise.all([
      Promise.all(owned.map((m) => listMerchantOrders(m.id).catch(() => []))),
      loadRatings(owned),
    ]);
    setOrders(perShop.flat());
    setAvgRating(averageRating(ratings.values()));
  }, [user.uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );


  const food = modules.find((m) => m.id === 'food');
  const others = modules.filter((m) => m.id !== 'food');
  const count = restaurants?.length ?? 0;
  const primary = restaurants?.[0];
  const several = count > 1;
  const restaurantLine = several ? `${count} restaurants` : primary?.name;
  const tagline = several
    ? restaurants!.map((m) => m.name).join(' · ')
    : primary
      ? primary.tagline || primary.cuisines.join(' · ')
      : '';
  const awaiting = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;

  const openRestaurants = () => navigation.navigate('SupplierRestaurants');
  // One restaurant: edit it. Several: the pencil can't know which one.
  const editPrimary = () =>
    primary && !several
      ? navigation.navigate('SupplierRestaurantInfo', { merchantId: primary.id })
      : openRestaurants();

  const openNotifications = () =>
    awaiting
      ? navigation.getParent()?.navigate('Orders')
      : navigation.navigate('ComingSoon', {
          title: 'Notifications',
          message:
            'Push and email alerts for new orders are coming. Until then, new orders appear on the Orders tab, and this bell shows a dot while orders are waiting.',
          actionLabel: 'Back to Dashboard',
        });

  // The service toggle is service-level (Figma draws the same "on" toggle on
  // "Book a Hotel · 4 options"), not a restaurant's open/closed switch: with two
  // restaurants there is no single restaurant it could mean. Opening and
  // closing lives on each restaurant card in Restaurant Management.
  const explainServiceToggle = () =>
    Alert.alert(
      'Order Food is active',
      'Customers can order from a restaurant only while it is open. Open or close each one from its ⋮ menu in Restaurant Management.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Restaurant Management', onPress: openRestaurants },
      ]
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Location: ${location}`}
            accessibilityHint={several || !primary ? 'Opens Restaurant Management' : 'Opens restaurant information'}
            onPress={editPrimary}
            hitSlop={8}
            style={({ pressed }) => [styles.locationRow, pressed && styles.pressed]}
          >
            <Icon name="mapPin" size={14} color={colors.primary} />
            <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1} style={styles.shrink}>
              {location}
            </Text>
            <View style={styles.chevronDown}>
              <Icon name="chevronRight" size={13} color={colors.textSecondary} />
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <HeaderButton
              icon="bell"
              label={awaiting ? `Notifications, ${awaiting} order${awaiting === 1 ? '' : 's'} waiting` : 'Notifications'}
              badge={awaiting > 0}
              onPress={openNotifications}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${user.fullName}, edit business profile`}
              onPress={() => navigation.navigate('EditProfile')}
              style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            >
              <Text variant="h2" color={colors.onPrimary}>
                {user.initial}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.headerText}>
          <Text variant="display" color={colors.text}>
            Business Dashboard
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            Manage your services in here.
          </Text>
        </View>

        <View style={styles.block}>
          <StatCards items={businessStats({ orders, rating: avgRating })} />
        </View>

        <View style={styles.block}>
          <Text variant="h3" color={colors.text}>
            Your Services
          </Text>

          <Text variant="eyebrow" color={colors.textMuted} style={[styles.eyebrow, styles.eyebrowActive]}>
            Active Services
          </Text>

          {food ? (
            <View style={[styles.activeCard, narrow && styles.activeCardNarrow]}>
              {/* The image + text open the service too — a bigger target than
                  the 28pt chevron — without nesting buttons inside a button. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${food.title}, Restaurant Management`}
                onPress={openRestaurants}
                style={({ pressed }) => [styles.serviceMain, narrow && styles.serviceMainNarrow, pressed && styles.pressedCard]}
              >
                <View style={styles.serviceIcon}>
                  <Image source={food.icon} style={styles.serviceImage} contentFit="cover" />
                </View>
                <View style={styles.serviceText}>
                  {/* Title and status may wrap: at 320pt the three controls
                      leave the text column ~65pt wide. */}
                  <Text variant="h5" color={colors.text} numberOfLines={2}>
                    {food.title}
                  </Text>
                  {restaurantLine ? (
                    <Text variant="labelSm" color={colors.primary} numberOfLines={1}>
                      {restaurantLine}
                    </Text>
                  ) : null}
                  {tagline ? (
                    <Text variant="captionRegular" color={colors.textMuted} numberOfLines={1}>
                      {tagline}
                    </Text>
                  ) : null}
                  <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text variant="micro" color={colors.primary} numberOfLines={2} style={styles.shrink}>
                      {restaurants === null
                        ? 'Active'
                        : count
                          ? `Active · ${count} option${count === 1 ? '' : 's'}`
                          : 'Active · add a restaurant'}
                    </Text>
                  </View>
                </View>
              </Pressable>
              <View style={[styles.controls, narrow && styles.controlsNarrow]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    several ? `Manage ${count} restaurants` : primary ? `Edit ${primary.name}` : 'Add a restaurant'
                  }
                  onPress={editPrimary}
                  hitSlop={6}
                  style={({ pressed }) => [styles.circleBtn, pressed && styles.pressed]}
                >
                  <Icon name="pencilSm" size={12} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: true }}
                  accessibilityLabel={`${food.title} service`}
                  onPress={explainServiceToggle}
                  hitSlop={6}
                  style={[styles.toggle, styles.toggleOn]}
                >
                  <View style={[styles.knob, styles.knobOn]} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Restaurant Management"
                  onPress={openRestaurants}
                  hitSlop={6}
                  style={({ pressed }) => [styles.circleBtn, pressed && styles.pressed]}
                >
                  <Icon name="chevronRight" size={12} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <Text variant="eyebrow" color={colors.textMuted} style={[styles.eyebrow, styles.eyebrowAvailable]}>
            Available to Activate
          </Text>

          <View style={styles.inactiveCard}>
            {others.map((m, i) => (
              <View key={m.id} style={[styles.inactiveRow, i === others.length - 1 && styles.rowLast]}>
                <View style={[styles.serviceIcon, styles.dimmed]}>
                  <Image source={m.icon} style={styles.serviceImage} contentFit="cover" />
                </View>
                <View style={styles.serviceText}>
                  <Text variant="labelLg" color={colors.textMuted} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text variant="microRegular" color={colors.borderStrong} style={styles.hint}>
                    Tap toggle to activate
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: false }}
                  accessibilityLabel={`${m.title} — not available yet`}
                  onPress={() =>
                    navigation.navigate('ComingSoon', {
                      title: m.title,
                      message: `Businesses can’t activate ${m.title} yet. When it launches you’ll switch it on here and run it next to Order Food.`,
                      actionLabel: 'Back to Dashboard',
                    })
                  }
                  hitSlop={10}
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
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
  pressedCard: { opacity: 0.85 },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[4],
    // 12 above the buttons, as on every header.
    paddingVertical: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5], flexShrink: 1 },
  // Figma's ⌄ is the same 1.08px chevron turned a quarter.
  chevronDown: { transform: [{ rotate: '90deg' }] },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
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
    paddingBottom: 16.5,
    borderBottomWidth: 0.54,
    borderBottomColor: colors.border,
  },

  // Figma stacks the header, stats and services 20 apart, each with 16 top pad.
  block: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[8] + spacing[6] },
  eyebrow: { paddingHorizontal: spacing[1.5], textTransform: 'uppercase' },
  eyebrowActive: { marginTop: spacing[4], marginBottom: spacing[3] },
  eyebrowAvailable: { marginTop: spacing[8], marginBottom: spacing[3] },

  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 0.51,
    borderColor: colors.primaryOutlineMd,
    ...shadows.serviceCard,
  },
  // Below 360pt: text on its own row, the controls under it on the right.
  activeCardNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: spacing[3] },
  serviceMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  serviceMainNarrow: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  dimmed: { opacity: 0.45 },
  serviceImage: { width: '100%', height: '100%' },
  serviceText: { flex: 1, minWidth: 0 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingTop: spacing[0.5],
  },
  statusDot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.primary },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  controlsNarrow: { justifyContent: 'flex-end' },
  circleBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inactiveCard: {
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 0.54,
    borderColor: colors.border,
    ...shadows.raised,
    overflow: 'hidden',
  },
  inactiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderBottomWidth: 0.54,
    borderBottomColor: colors.surfaceAlt,
  },
  rowLast: { borderBottomWidth: 0 },
  hint: { paddingTop: spacing[0.5] },

  toggle: {
    width: 44,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.primary },
  knob: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginLeft: 3,
    ...shadows.toggleKnob,
  },
  knobOn: { marginLeft: 23, ...shadows.tile },
});
