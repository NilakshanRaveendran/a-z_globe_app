import { useState } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { showToast } from '@core/ui';
import { Alert } from '@core/ui/alert';
import type { Merchant } from '@modules/food/types';
import type { RootStackParamList } from '@app/navigation/types';
import { archiveRestaurant, setRestaurantOpen } from '../services/restaurants';
import { ACTIVE_STATUSES, listMerchantOrders } from '../services/orders';
import { listAllMenuItems } from '../services/menu';
import { openingHoursProblems } from '../services/restaurantValidation';

/** "1 active order", "5 active orders". */
function activeOrders(count: number): string {
  return `${count} active order${count === 1 ? '' : 's'}`;
}

/** Orders still in progress, or null when they could not be read. */
async function activeOrderCount(merchantId: string): Promise<number | null> {
  const orders = await listMerchantOrders(merchantId).catch(() => null);
  return orders ? orders.filter((order) => ACTIVE_STATUSES.includes(order.status)).length : null;
}

/**
 * Opening, closing and archiving a restaurant — the same safeguards wherever
 * the owner does it (the ⋮ menu on Restaurant Management, the switch in the
 * hub header):
 *
 *   open     only once it can take an order: at least one available dish and
 *            valid opening hours. Otherwise say what is missing and offer the
 *            screen that fixes it.
 *   close    confirmed, naming the orders still in progress — closing stops new
 *            orders, it does not cancel the ones being cooked.
 *   archive  refused while any order is active; otherwise confirmed.
 *
 * `onChanged` runs after a successful change so the caller can reload.
 */
export function useRestaurantControls({
  onChanged,
  onArchived,
}: {
  onChanged: () => void;
  /** Where to go once a restaurant is archived; defaults to `onChanged`. */
  onArchived?: () => void;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  // The restaurant being checked or written, so its control can show busy.
  const [busyId, setBusyId] = useState<string | null>(null);

  const write = async (m: Merchant, isOpen: boolean) => {
    setBusyId(m.id);
    try {
      await setRestaurantOpen(m.id, isOpen);
      showToast(isOpen ? `${m.name} is open · customers can order now` : `${m.name} is closed to new orders`);
      onChanged();
    } catch {
      showToast(isOpen ? 'Could not open the restaurant. Try again.' : 'Could not close the restaurant. Try again.', {
        tone: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const open = async (m: Merchant) => {
    setBusyId(m.id);
    let menu: Awaited<ReturnType<typeof listAllMenuItems>> | null = null;
    try {
      menu = await listAllMenuItems(m.id);
    } catch {
      setBusyId(null);
      showToast('Could not check the menu. Check your connection and try again.', { tone: 'error' });
      return;
    }
    const noDish = !menu.some((item) => item.available !== false);
    const hours = openingHoursProblems(m.hours);
    if (noDish || hours.length) {
      setBusyId(null);
      const steps = [
        ...(noDish ? ['Add at least one available dish to the menu.'] : []),
        ...hours,
      ];
      Alert.alert(`${m.name} isn’t ready to open`, steps.join(' '), [
        ...(noDish
          ? [{
              text: 'Go to Menu Management',
              onPress: () => navigation.navigate('SupplierMenu', { merchantId: m.id, merchantName: m.name }),
            }]
          : []),
        ...(hours.length
          ? [{
              text: 'Fix opening hours',
              onPress: () => navigation.navigate('SupplierRestaurantInfo', { merchantId: m.id }),
            }]
          : []),
        { text: 'Not now', style: 'cancel' as const },
      ]);
      return;
    }
    await write(m, true);
  };

  const close = async (m: Merchant) => {
    setBusyId(m.id);
    const active = await activeOrderCount(m.id);
    setBusyId(null);
    Alert.alert(
      `Close ${m.name}?`,
      active
        ? `It has ${activeOrders(active)}. Closing only stops new orders — you can still finish ${active === 1 ? 'it' : 'them'} from Active Orders.`
        : 'Customers won’t be able to order from it until you open it again.',
      [
        { text: 'Keep open', style: 'cancel' },
        { text: 'Close restaurant', style: 'destructive', onPress: () => void write(m, false) },
      ]
    );
  };

  /** Open a closed restaurant, or close an open one — each with its checks. */
  const toggleOpen = (m: Merchant) => (m.isOpen ? close(m) : open(m));

  const archive = async (m: Merchant) => {
    setBusyId(m.id);
    const active = await activeOrderCount(m.id);
    setBusyId(null);
    // Archived restaurants drop out of the live order lists, so never archive
    // one whose orders couldn't be checked.
    if (active === null) {
      showToast('Could not check its active orders. Check your connection and try again.', { tone: 'error' });
      return;
    }
    if (active) {
      Alert.alert(
        `Finish ${m.name}’s orders first`,
        `It has ${activeOrders(active)}. Complete or cancel ${active === 1 ? 'it' : 'them'}, then archive the restaurant.`,
        [
          {
            text: 'View active orders',
            onPress: () => navigation.navigate('SupplierOrders', { merchantId: m.id, merchantName: m.name }),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    Alert.alert(
      `Archive ${m.name}?`,
      'It closes, leaves your restaurant list and customers can no longer find it. Its past orders and reviews are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive restaurant',
          style: 'destructive',
          onPress: async () => {
            setBusyId(m.id);
            try {
              await archiveRestaurant(m.id);
              showToast(`${m.name} archived`);
              (onArchived ?? onChanged)();
            } catch {
              showToast('Could not archive the restaurant. Try again.', { tone: 'error' });
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return { busyId, toggleOpen, archive };
}
