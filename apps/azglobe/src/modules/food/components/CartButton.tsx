import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { HeaderButton, type HeaderButtonTone } from '@core/ui';
import type { RootStackParamList } from '@app/navigation/types';
import { useCart } from '../store/cart';

/**
 * The cart in the food headers — the shared HeaderButton with a red count.
 * The glyph gives a little bump each time something is added, so adding a
 * dish without leaving the page still shows it landed. Tapping opens the cart.
 */
export function CartButton({ tone, style }: { tone?: HeaderButtonTone; style?: StyleProp<ViewStyle> }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const count = useCart((s) => s.itemCount());
  const bump = useRef(new Animated.Value(1)).current;
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current) {
      const native = Platform.OS !== 'web';
      bump.setValue(1);
      Animated.sequence([
        Animated.timing(bump, { toValue: 1.25, duration: 120, useNativeDriver: native }),
        Animated.spring(bump, { toValue: 1, friction: 4, useNativeDriver: native }),
      ]).start();
    }
    previous.current = count;
  }, [count, bump]);

  return (
    <HeaderButton
      icon="cart"
      tone={tone}
      style={style}
      label={count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
      badge={count}
      iconScale={bump}
      onPress={() => navigation.navigate('Food', { screen: 'Cart' })}
    />
  );
}
