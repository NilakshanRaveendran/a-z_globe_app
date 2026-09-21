import { View } from 'react-native';
import { Screen } from '@core/ui';

/**
 * Placeholder for the Cart tab.
 *
 * The cart itself lives inside the Food module (its contents are food orders),
 * so the tab forwards into that module's Cart screen — see the `tabPress`
 * listener in TabNavigator. Nothing forwards from HERE: doing it on focus made
 * the cart impossible to leave, because backing out of it landed on this tab,
 * which pushed the cart again. With the listener preventing default this
 * component is never actually shown; it exists because a Tab.Screen needs one.
 *
 * When other modules gain carts this becomes a chooser.
 */
export function CartTabScreen() {
  return (
    <Screen>
      <View />
    </Screen>
  );
}
