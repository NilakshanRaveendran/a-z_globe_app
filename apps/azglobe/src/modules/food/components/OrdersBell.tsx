import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StyleProp, ViewStyle } from 'react-native';
import { HeaderButton, type HeaderButtonTone } from '@core/ui';
import type { RootStackParamList } from '@app/navigation/types';
import { useActiveOrder } from '../store/activeOrder';

/**
 * The bell in the Home and food headers (324:1708, 31:11648, 16:4256) — the
 * shared HeaderButton, so it matches the back button and cart beside it.
 *
 * There is no notifications feed yet, so the bell is the way into orders: with
 * an order on its way it shows Figma's red dot and opens that order's
 * tracking; otherwise it opens My Orders. The dot is never shown for nothing.
 */
export function OrdersBell({ tone, style }: { tone?: HeaderButtonTone; style?: StyleProp<ViewStyle> }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const orderId = useActiveOrder((s) => s.orderId);
  return (
    <HeaderButton
      icon="bell"
      tone={tone}
      style={style}
      label={orderId ? 'Track your order' : 'My orders'}
      badge={!!orderId}
      onPress={() =>
        orderId
          ? navigation.navigate('Food', { screen: 'OrderTracking', params: { orderId } })
          : navigation.navigate('Food', { screen: 'MyOrders' })
      }
    />
  );
}
