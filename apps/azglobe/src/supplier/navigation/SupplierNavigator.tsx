import { NotificationsScreen } from '@app/screens/NotificationsScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, NavIcons, Text } from '@core/ui';
import { colors, spacing } from '@core/theme';
import type { RootStackParamList, SupplierTabParamList } from '@app/navigation/types';
import { MessagesScreen } from '@app/screens/MessagesScreen';
import { SupplierDashboardScreen } from '../screens/SupplierDashboardScreen';
import { SupplierProfileScreen } from '../screens/SupplierProfileScreen';
import { SupplierOrdersScreen } from '../screens/SupplierOrdersScreen';
import { RestaurantManagementScreen } from '../screens/RestaurantManagementScreen';
import { RestaurantHubScreen } from '../screens/RestaurantHubScreen';
import { MenuManagementScreen } from '../screens/MenuManagementScreen';
import { ActiveOrdersScreen } from '../screens/ActiveOrdersScreen';
import { OrderHistoryScreen } from '../screens/OrderHistoryScreen';
import { OffersScreen } from '../screens/OffersScreen';
import { RestaurantInfoScreen } from '../screens/RestaurantInfoScreen';
import { ReviewsScreen } from '../screens/ReviewsScreen';

const Tab = createBottomTabNavigator<SupplierTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function BusinessHome() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupplierDashboard" component={SupplierDashboardScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="SupplierRestaurants" component={RestaurantManagementScreen} />
      <Stack.Screen name="SupplierRestaurantHub" component={RestaurantHubScreen} />
      <Stack.Screen name="SupplierMenu" component={MenuManagementScreen} />
      <Stack.Screen name="SupplierOrders" component={ActiveOrdersScreen} />
      <Stack.Screen name="SupplierOrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="SupplierOffers" component={OffersScreen} />
      <Stack.Screen name="SupplierRestaurantInfo" component={RestaurantInfoScreen} />
      <Stack.Screen name="SupplierReviews" component={ReviewsScreen} />
    </Stack.Navigator>
  );
}

function BusinessOrders() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupplierOrdersOverview" component={SupplierOrdersScreen} />
      <Stack.Screen name="SupplierOrders" component={ActiveOrdersScreen} />
      <Stack.Screen name="SupplierOrderHistory" component={OrderHistoryScreen} />
    </Stack.Navigator>
  );
}

/**
 * The Profile tab is a stack too, so its "Home" row opens Restaurant
 * Information on top of Business Profile: Back returns to Profile, and the Home
 * tab's route never carries nested params (which the web tab link serialised as
 * `params=[object Object]`).
 */
function BusinessProfile() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupplierProfile" component={SupplierProfileScreen} />
      <Stack.Screen name="SupplierRestaurantInfo" component={RestaurantInfoScreen} />
    </Stack.Navigator>
  );
}

/**
 * Business BottomNav — Figma 147:4775 / 385:3196, the same component as the
 * customer bar (31:12072), with "Orders" where the customer has "Cart" (a
 * business cannot order).
 *
 *   bar    h66 · #FFFFFF · 1px top rule #F3F4F6 · no shadow · pad 5 top
 *   item   74 wide · pad 8v · col gap 3 · 22pt glyph · Urbanist 500 10/15
 *   tint   active #D42B2B, inactive #9CA3AF
 *
 * Items share the width equally, exactly like the customer TabNavigator, so
 * the bar does not shift when an account switches; that sits within ~4pt of
 * Figma's justify-between placement at 393pt.
 */
function TabIcon({ name, focused }: { name: keyof SupplierTabParamList; focused: boolean }) {
  const color = focused ? colors.primary : colors.textMuted;
  const Glyph = name === 'Orders' ? null : NavIcons[name];
  return (
    <View style={styles.item}>
      {Glyph ? <Glyph width={22} height={22} color={color} /> : <Icon name="activeOrders" size={22} color={color} />}
      <Text variant="tabLabel" color={color} align="center" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export function SupplierNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator initialRouteName="Home" screenOptions={({ route }) => ({
      headerShown: false, tabBarShowLabel: false,
      tabBarAccessibilityLabel: route.name,
      tabBarStyle: [styles.bar, { height: 66 + insets.bottom, paddingBottom: insets.bottom }],
      tabBarItemStyle: styles.tab,
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
    })}>
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Orders" component={BusinessOrders} />
      <Tab.Screen name="Home" component={BusinessHome} />
      <Tab.Screen name="Profile" component={BusinessProfile} />
    </Tab.Navigator>
  );
}
const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    // The shorthand, not borderTopColor: React Navigation sets `borderColor`
    // itself, and on web the shorthand it passes wins over a longhand.
    borderColor: colors.surfaceAlt,
    paddingTop: spacing[2],
    // React Navigation applies its own elevation; the design has none.
    elevation: 0,
    boxShadow: 'none',
  },
  tab: { paddingVertical: spacing[3] },
  item: { width: 74, alignItems: 'center', gap: spacing[1] },
});
