import type { NavigatorScreenParams } from '@react-navigation/native';
import type { AddressLabel, BuildingType } from '../types';

/**
 * Routes owned by the Food module. Nothing outside `src/modules/food` should
 * need to know these names — the shell only routes to `FoodRoot`.
 */
export type FoodStackParamList = {
  FoodLanding: undefined;
  Featured: { title?: string } | undefined;
  Restaurant: { merchantId: string; tab?: 'menu' | 'reviews' | 'info' };
  MenuAll: { merchantId: string };
  ItemDetail: { merchantId: string; menuItemId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderPlaced: { orderId: string };
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

export type FoodModuleParams = NavigatorScreenParams<FoodStackParamList>;
