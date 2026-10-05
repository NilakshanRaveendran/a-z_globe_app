import type { NavigatorScreenParams } from '@react-navigation/native';
import type { FoodStackParamList } from '@modules/food/navigation/types';

/** The four tabs in Figma's BottomNav (31:12072), left to right. */
export type TabParamList = {
  Messages: undefined;
  CartTab: undefined;
  Home: undefined;
  Profile: undefined;
};

export type SupplierTabParamList = {
  Messages: undefined;
  Orders: undefined;
  Home: NavigatorScreenParams<RootStackParamList> | undefined;
  /** A stack: Business Profile, and Restaurant Information opened from its "Home" row. */
  Profile: NavigatorScreenParams<RootStackParamList> | undefined;
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
  Messaging: { groupId?: string; created?: boolean } | undefined;
  /**
   * `message` and `actionLabel` replace the customer copy ("Order Food is
   * available today", "Back to Home") where that would be wrong — the business
   * screens pass their own.
   */
  ComingSoon: { title: string; message?: string; actionLabel?: string };
  /** Profile → Notifications: the customer's notification preferences. */
  Notifications: undefined;
  NotificationSettings: undefined;
  /** The identity row on either profile: personal details, or the business's. */
  EditProfile: undefined;
  SupplierDashboard: undefined;
  SupplierTabs: undefined;
  SupplierOrdersOverview: undefined;
  SupplierRestaurants: undefined;
  SupplierRestaurantHub: { merchantId: string };
  SupplierMenu: { merchantId: string; merchantName: string };
  SupplierOrders: { merchantId: string; merchantName: string };
  SupplierOrderHistory: { merchantId: string; merchantName: string };
  SupplierOffers: { merchantId: string; merchantName: string };
  SupplierRestaurantInfo: { merchantId: string };
  SupplierReviews: { merchantId: string; merchantName: string };
  SupplierProfile: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
