import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FoodLandingScreen } from '../screens/FoodLandingScreen';
import { FeaturedScreen } from '../screens/FeaturedScreen';
import { RestaurantScreen } from '../screens/RestaurantScreen';
import { MenuAllScreen } from '../screens/MenuAllScreen';
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
import { CartScreen } from '../screens/CartScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { OrderPlacedScreen } from '../screens/OrderPlacedScreen';
import { AddressInfoScreen } from '../screens/AddressInfoScreen';
import { BuildingTypeScreen } from '../screens/BuildingTypeScreen';
import type { FoodStackParamList } from './types';

const Stack = createNativeStackNavigator<FoodStackParamList>();

/**
 * The Food module's navigator. The shell mounts this under the `Food` route and
 * knows nothing about what is inside it — see `src/modules/registry.ts`.
 *
 * Every screen draws its own header (the designs put the title inside the
 * scrolling content, often over a hero image), so the native header is off.
 */
export function FoodNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FoodLanding" component={FoodLandingScreen} />
      <Stack.Screen name="Featured" component={FeaturedScreen} />
      <Stack.Screen name="Restaurant" component={RestaurantScreen} />
      <Stack.Screen name="MenuAll" component={MenuAllScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen
        name="OrderPlaced"
        component={OrderPlacedScreen}
        // The order is placed — back should not return to Checkout.
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="AddressInfo" component={AddressInfoScreen} />
      <Stack.Screen name="BuildingType" component={BuildingTypeScreen} />
    </Stack.Navigator>
  );
}
