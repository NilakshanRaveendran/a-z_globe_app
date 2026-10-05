import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, ScreenHeader, Text } from '@core/ui';
import { colors } from '@core/theme';
import { ReviewPrompt, TrackOrderCard } from '../components/TrackOrderCard';
import { useLiveOrders } from '../hooks/useLiveOrders';
import { useActiveOrder } from '../store/activeOrder';
import type { FoodStackParamList } from '../navigation/types';

export function LiveOrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FoodStackParamList>>();
  const orders = useLiveOrders();
  const reviewed = useActiveOrder(s => s.reviewPrompted);
  const ids = useActiveOrder(s => s.orderIds);
  return <Screen>
    <ScreenHeader title="Live orders" subtitle="Track each restaurant separately" onBack={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {orders.length ? <Text variant="bodyLg" color={colors.textSecondary} style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        Each restaurant has its own preparation and arrival time. Tap an order for details.
      </Text> : <View style={{ padding: 24, gap: 16 }}>
        <Text variant="h4">{ids.length ? 'Loading your orders…' : 'You’re all caught up'}</Text>
        {!ids.length ? <><Text variant="bodyLg" color={colors.textSecondary}>Your completed orders are saved in My orders.</Text><Button label="View my orders" onPress={() => navigation.navigate('MyOrders')} /></> : null}
      </View>}
      {orders.map(order => <TrackOrderCard key={order.id} compact order={order}
        onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
        footer={order.status === 'delivered' && !reviewed.includes(order.id) ? <ReviewPrompt order={order} /> : null} />)}
    </ScrollView>
  </Screen>;
}
