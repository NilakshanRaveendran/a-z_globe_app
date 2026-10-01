import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CartContent } from '@modules/food/screens/CartScreen';
import type { RootStackParamList } from '@app/navigation/types';

export function CartTabScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <CartContent
      inTab
      onBrowse={() => navigation.navigate('Food', { screen: 'FoodLanding' })}
      onCheckout={() => navigation.navigate('Food', { screen: 'Checkout' })}
      onAddress={(params) => navigation.navigate('Food', { screen: 'AddressInfo', params })}
    />
  );
}
