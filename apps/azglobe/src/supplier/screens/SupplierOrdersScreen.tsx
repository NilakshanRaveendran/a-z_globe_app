import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, radius, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, Text } from '@core/ui';
import { useSession } from '@app/providers/SessionProvider';
import type { RootStackParamList } from '@app/navigation/types';
import type { Merchant } from '@modules/food/types';
import { listOwnedRestaurants } from '../services/restaurants';
import { SupplierHeader } from '../components/SupplierHeader';
import { LiveOrderList } from '../components/LiveOrderList';
import { ActionMenu, measureAnchor, type MenuAnchor } from '../components/ActionMenu';

/**
 * The business Orders tab. Figma has no frame for it — the bar shows "Cart"
 * there, which a business has no use for — so it is Active Orders (335:4972)
 * run across every restaurant the account owns: the same header, status chips
 * and order cards, with the restaurant named on each card when there is more
 * than one.
 *
 *   header   SupplierHeader without a back button · "Orders" · the
 *            restaurant (or "N restaurants") in #D42B2B · a "History" pill
 *            styled as Order History's Date chip (#F3F4F6, pad 6/10, 14pt
 *            glyph, 500 12/18 #374151) on the right
 */
export function SupplierOrdersScreen() {
  const { user } = useSession();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [restaurants, setRestaurants] = useState<Merchant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const historyButton = useRef<View>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRestaurants(await listOwnedRestaurants(user.uid));
    } catch {
      setFailed(true);
    }
  }, [user.uid]);

  // A restaurant added on the Home tab must show up here without a restart.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const merchants = useMemo(
    () => restaurants?.map((r) => ({ id: r.id, name: r.name })) ?? null,
    [restaurants]
  );
  const many = (restaurants?.length ?? 0) > 1;

  const openHistory = () => {
    if (!restaurants?.length) return;
    const go = (r: Merchant) =>
      navigation.navigate('SupplierOrderHistory', { merchantId: r.id, merchantName: r.name });
    if (restaurants.length === 1) {
      go(restaurants[0]!);
      return;
    }
    measureAnchor(historyButton, setMenu);
  };

  // The shared provider popover (S23), one row per restaurant. Two with the
  // same name are told apart by their address.
  const historyItems = (restaurants ?? []).map((r) => ({
    label: r.name,
    icon: 'store' as const,
    ...(restaurants!.filter((o) => o.name === r.name).length > 1 && (r.address || r.tagline)
      ? { hint: r.address || r.tagline }
      : {}),
    onPress: () => navigation.navigate('SupplierOrderHistory', { merchantId: r.id, merchantName: r.name }),
  }));

  const subtitle =
    restaurants === null
      ? ' '
      : restaurants.length === 1
        ? restaurants[0]!.name
        : restaurants.length > 1
          ? `${restaurants.length} restaurants`
          : undefined;

  return (
    <Screen>
      <SupplierHeader
        title="Orders"
        subtitle={subtitle}
        action={
          restaurants?.length ? (
            <Pressable
              ref={historyButton}
              accessibilityRole="button"
              accessibilityLabel="Order history"
              onPress={openHistory}
              style={({ pressed }) => [styles.historyChip, pressed && styles.pressed]}
            >
              <Icon name="orderHistory" size={14} color={colors.palette.gray700} />
              <Text variant="bodySm" color={colors.palette.gray700}>
                History
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {failed ? (
        <View style={styles.message}>
          <EmptyState
            title="Something went wrong"
            message="Could not load your restaurants."
            actionLabel="Try again"
            onAction={() => void load()}
          />
        </View>
      ) : restaurants === null ? (
        <View style={styles.message}>
          <Skeleton height={77} borderRadius={radius['3xl']} />
          <Skeleton height={77} borderRadius={radius['3xl']} />
        </View>
      ) : restaurants.length === 0 ? (
        <View style={styles.message}>
          <EmptyState
            title="No restaurants yet"
            message="Add a restaurant from Home → Restaurant Management, and its orders will appear here."
          />
        </View>
      ) : (
        <LiveOrderList merchants={merchants} showMerchant={many} />
      )}

      <ActionMenu anchor={menu} title="Which restaurant's history?" items={historyItems} onClose={() => setMenu(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.6 },
  message: { paddingHorizontal: spacing[6], paddingTop: spacing[4], gap: spacing[4] },
});
