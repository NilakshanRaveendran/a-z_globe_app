import type { AddressLabel, BuildingType } from '../types';

/**
 * Routes owned by the Food module. Nothing outside `src/modules/food` should
 * need to know these names — the shell only routes to `FoodRoot`.
 */
export type FoodStackParamList = {
  FoodLanding: undefined;
  Featured: { title?: string } | undefined;
  Restaurant: { merchantId: string; tab?: 'menu' | 'reviews' | 'info' };
  /** `offers` opens on the dishes the restaurant's running offer covers. */
  MenuAll: { merchantId: string; offers?: boolean };
  ItemDetail: { merchantId: string; menuItemId: string };
  Cart: undefined;
  Checkout: undefined;
  /** `orderIds` when one checkout placed an order at several restaurants. */
  OrderPlaced: { orderId: string; orderIds?: string[] };
  /** Live tracking and details for one order — opened from Home, Order Placed and My Orders. */
  OrderTracking: { orderId: string };
  /** The customer's past and current orders (Profile → My orders). */
  MyOrders: undefined;
  /**
   * Search across restaurants and dishes — the Order Food search bar. With an
   * empty query it lists the popular dishes, which is what Home's "Popular
   * Dishes · See all" opens (`autoFocus: false`, so the keyboard stays down).
   */
  Search: { autoFocus?: boolean } | undefined;
  AddressInfo:
    | {
        /** Editing an existing address. */
        addressId?: string;
        /** New address: prefill from the sheet's search text or shortcut. */
        line1?: string;
        label?: AddressLabel;
        /** Arrived from "Use my current location" — pin on open. */
        useLocation?: boolean;
        /** Handed back by the Building Type screen. */
        buildingType?: BuildingType;
      }
    | undefined;
  BuildingType: { addressId?: string; current?: BuildingType };
};

