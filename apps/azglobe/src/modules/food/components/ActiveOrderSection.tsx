import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ReviewPrompt, TrackOrderCard } from './TrackOrderCard';
import { useOrderTracking } from '../hooks/useOrderTracking';
import { useReviewPrompted } from '../store/activeOrder';
import type { RootStackParamList } from '@app/navigation/types';

/**
 * The live-order card on Home — Figma 324:2157.
 *
 * Renders nothing when there is no active order, which is exactly the
 * difference between Home (324:1708) and Home with a live activity — in demo
 * mode too; there is no sample order (C4).
 *
 * The whole card opens Order Tracking, where the full card, the items, the
 * address and Call / Cancel live (C2). Once the order is delivered it asks
 * "How was your order?" until the customer reviews it or says not now.
 */
export function ActiveOrderSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const order = useOrderTracking();
  const prompted = useReviewPrompted(order?.id);

  if (!order) return null;

  return (
    <TrackOrderCard
      compact
      order={order}
      onPress={() => navigation.navigate('Food', { screen: 'OrderTracking', params: { orderId: order.id } })}
      footer={order.status === 'delivered' && !prompted ? <ReviewPrompt order={order} /> : null}
    />
  );
}
