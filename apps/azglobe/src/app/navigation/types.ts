import type { NavigatorScreenParams } from '@react-navigation/native';
import type { FoodStackParamList } from '@modules/food/navigation/types';

/** The four tabs in Figma's BottomNav (31:12072), left to right. */
export type TabParamList = {
  Messages: undefined;
  CartTab: undefined;
  Home: undefined;
  Profile: undefined;
};

/**
 * The root stack. Module navigators are mounted here under their own route —
 * `Food` today, and one entry per module as they ship.
 *
 * `SupplierDashboard` is never mounted alongside the rest: a supplier account
 * gets its own tree (see RootNavigator), so the two sets of routes are mutually
 * exclusive at runtime even though they share this type.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Food: NavigatorScreenParams<FoodStackParamList>;
  ComingSoon: { title: string };
  SupplierDashboard: undefined;
  SupplierRestaurants: undefined;
  SupplierRestaurantHub: { merchantId: string };
  SupplierMenu: { merchantId: string; merchantName: string };
  SupplierOrders: { merchantId: string; merchantName: string };
  SupplierOrderHistory: { merchantId: string; merchantName: string };
  SupplierOffers: { merchantId: string; merchantName: string };
  SupplierRestaurantInfo: { merchantId: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
