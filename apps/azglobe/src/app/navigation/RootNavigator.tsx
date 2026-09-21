import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, fontFamily } from '@core/theme';
import { liveModules } from '@modules/registry';
import { TabNavigator } from './TabNavigator';
import { ComingSoonScreen } from '@app/screens/ComingSoonScreen';
import { AccountUnavailableScreen } from '@app/screens/AccountUnavailableScreen';
import { AuthNavigator } from '@app/auth/AuthNavigator';
import { useSession } from '@app/providers/SessionProvider';
import { SupplierDashboardScreen } from '@/supplier/screens/SupplierDashboardScreen';
import { OrderHistoryScreen } from '@/supplier/screens/OrderHistoryScreen';
import { OffersScreen } from '@/supplier/screens/OffersScreen';
import { MenuManagementScreen } from '@/supplier/screens/MenuManagementScreen';
import { ActiveOrdersScreen } from '@/supplier/screens/ActiveOrdersScreen';
import { RestaurantInfoScreen } from '@/supplier/screens/RestaurantInfoScreen';
import { RestaurantManagementScreen } from '@/supplier/screens/RestaurantManagementScreen';
import { RestaurantHubScreen } from '@/supplier/screens/RestaurantHubScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Navigation theme. React Navigation paints the screen background before a
 * screen renders, so it has to match the design's white or a flash shows on
 * push.
 */
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
  fonts: {
    regular: { fontFamily: fontFamily[400], fontWeight: '400' as const },
    medium: { fontFamily: fontFamily[500], fontWeight: '500' as const },
    bold: { fontFamily: fontFamily[700], fontWeight: '700' as const },
    heavy: { fontFamily: fontFamily[900], fontWeight: '900' as const },
  },
};

/**
 * Root stack: the four-tab shell, plus one route per live module mounted from
 * the registry. Adding a module adds a route here automatically.
 *
 * A-Z Globe is one app serving two kinds of account, so this is also where the
 * two part company. Signing in resolves whether the uid is a customer or a
 * supplier (see SessionProvider), and that decides which tree is mounted — the
 * ordering experience, or the business one. They are separate trees rather than
 * a flag inside one, because a supplier has no cart, no delivery address and no
 * module grid; sharing a navigator would mean guarding every screen instead of
 * simply never mounting them.
 *
 * While signed out the auth stack replaces the whole tree rather than sitting
 * on top of it — so there is no tab bar behind the sign-in screens and no way
 * to swipe back into the app.
 */
export function RootNavigator() {
  const { stage, accountKind } = useSession();

  return (
    <NavigationContainer theme={navTheme}>
      {stage === 'loading' ? (
        // Explicit background: NavigationContainer does not paint one, so a
        // transparent loading view shows the black window behind it.
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : stage === 'account-unknown' ? (
        // Signed in, but we could not read which kind of account this is.
        // Never guess — see AccountUnavailableScreen.
        <AccountUnavailableScreen />
      ) : stage === 'ready' && accountKind === 'supplier' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SupplierDashboard" component={SupplierDashboardScreen} />
          <Stack.Screen name="SupplierRestaurants" component={RestaurantManagementScreen} />
          <Stack.Screen name="SupplierRestaurantHub" component={RestaurantHubScreen} />
          <Stack.Screen name="SupplierMenu" component={MenuManagementScreen} />
          <Stack.Screen name="SupplierOrders" component={ActiveOrdersScreen} />
          <Stack.Screen name="SupplierOrderHistory" component={OrderHistoryScreen} />
          <Stack.Screen name="SupplierOffers" component={OffersScreen} />
          <Stack.Screen name="SupplierRestaurantInfo" component={RestaurantInfoScreen} />
          <Stack.Screen
            name="ComingSoon"
            component={ComingSoonScreen}
            options={{ presentation: 'modal' }}
          />
        </Stack.Navigator>
      ) : stage === 'ready' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabNavigator} />

          {liveModules.map((m) => (
            <Stack.Screen key={m.id} name={m.route as 'Food'} component={m.navigator} />
          ))}

          <Stack.Screen
            name="ComingSoon"
            component={ComingSoonScreen}
            options={{ presentation: 'modal' }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator
          initialRoute={
            stage === 'needs-account-type'
              ? 'ChooseAccountType'
              : stage === 'needs-profile'
                ? 'CompleteProfile'
                : 'Phone'
          }
        />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
