import { useMemo } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '@core/ui';
import type { RootStackParamList } from '@app/navigation/types';
import { SupplierHeader } from '../components/SupplierHeader';
import { LiveOrderList } from '../components/LiveOrderList';

/**
 * Active Orders — Figma 335:4972.
 *
 *   header   SupplierHeader: 36pt back · "Active Orders" 700 22/33 ·
 *            restaurant name 400 13/19.5 #D42B2B
 *   filters  Active · New · Accepted · Preparing · Ready · Picked up · Delivered
 *   cards    OrderCard (335:5771) — collapsed to the customer row, tapped open
 *            to the tracker, items, total, note, ETA and the step actions
 *
 * The chips, cards, actions and their state machine live in LiveOrderList,
 * which the Orders tab shares.
 */
export function ActiveOrdersScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierOrders'>>();
  const { merchantId, merchantName } = params;
  const merchants = useMemo(() => [{ id: merchantId, name: merchantName }], [merchantId, merchantName]);

  return (
    <Screen>
      <SupplierHeader title="Active Orders" subtitle={merchantName} onBack={() => navigation.goBack()} />
      <LiveOrderList merchants={merchants} />
    </Screen>
  );
}
