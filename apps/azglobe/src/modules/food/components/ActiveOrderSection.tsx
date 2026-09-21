import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TrackOrderCard } from './TrackOrderCard';
import { useOrderTracking } from '../hooks/useOrderTracking';
import { useMerchant } from '../hooks/queries';
import type { RootStackParamList } from '@app/navigation/types';

/**
 * The live-order card on Home — Figma 324:2157.
 *
 * Renders nothing when there is no active order, which is exactly the
 * difference between Home (324:1708) and Home with a live activity.
 */
export function ActiveOrderSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrderTracking();
  const { data: merchant } = useMerchant(order?.merchantId ?? '');

  if (!order) return null;

  return (
    <TrackOrderCard
      order={order}
      merchantPhone={merchant?.phone}
      onTrack={() =>
        navigation.navigate('Food', {
          screen: 'Restaurant',
          params: { merchantId: order.merchantId },
        })
      }
    />
  );
}
