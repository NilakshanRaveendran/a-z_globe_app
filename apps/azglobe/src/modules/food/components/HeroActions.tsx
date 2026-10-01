import type { StyleProp, ViewStyle } from 'react-native';
import { HeaderButtonRow, type HeaderButtonTone } from '@core/ui';
import { CartButton } from './CartButton';
import { OrdersBell } from './OrdersBell';

/**
 * The food headers' bell + cart, as one unit so every screen places them the
 * same way: right-hand end of the header row, standard gap. `overlay` for the
 * pages that open on a photo (restaurant, dish).
 */
export function HeroActions({ tone, style }: { tone?: HeaderButtonTone; style?: StyleProp<ViewStyle> }) {
  return (
    <HeaderButtonRow style={style}>
      <OrdersBell tone={tone} />
      <CartButton tone={tone} />
    </HeaderButtonRow>
  );
}
