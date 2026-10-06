import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { showToast } from '@core/ui';
import { useCart } from '../store/cart';
import type { MenuItem, SelectedOption } from '../types';

/**
 * The one way screens put a dish in the cart.
 *
 * - A sold-out dish is refused with a message instead of being added.
 * - Dishes from any restaurant go in the same cart; Cart groups them by
 *   restaurant and Checkout places one order for each, paid together.
 * - Every add confirms with a toast that links to the cart.
 *
 * Without `options` it is a quick add: required single-choice groups take
 * their default, as the "+" on dish cards always has.
 */
export function useAddToCart() {
  const navigation = useNavigation();
  const add = useCart((s) => s.add);
  const addFromMenuItem = useCart((s) => s.addFromMenuItem);

  return useCallback(
    (item: MenuItem, choice?: { options: SelectedOption[]; qty: number }, onAdded?: () => void) => {
      if (item.available === false) {
        showToast(`${item.name} is sold out right now`, { tone: 'error' });
        return;
      }

      const missing = item.optionGroups.find(group => group.required && (choice
        ? !choice.options.some(option => option.groupKey === group.key)
        : group.type === 'multi'));
      if (missing) {
        if (!choice) navigation.navigate('Food', { screen: 'ItemDetail', params: { merchantId: item.merchantId, menuItemId: item.id } });
        showToast(`Choose ${missing.label} before adding this dish.`, { tone: 'error' });
        return;
      }
      if (choice) add(item, choice.options, choice.qty);
      else addFromMenuItem(item);
      showToast(`${item.name} added to cart`, {
        action: { label: 'View cart', onPress: () => navigation.navigate('Food', { screen: 'Cart' }) },
      });
      onAdded?.();
    },
    [add, addFromMenuItem, navigation]
  );
}
