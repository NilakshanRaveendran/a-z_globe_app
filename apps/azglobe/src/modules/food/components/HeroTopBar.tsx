import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@core/ui';
import { SCREEN_PADDING, spacing } from '@core/theme';
import { HeroActions } from './HeroActions';

/**
 * The top row over a hero photo (restaurant, dish): back on the left, bell +
 * cart on the right — the same buttons, size and inset as ScreenHeader's row
 * on the white screens, frosted so they read on the image.
 */
export function HeroTopBar({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { top: insets.top + spacing[4] }]} pointerEvents="box-none">
      <BackButton tone="overlay" onPress={onBack} />
      <HeroActions tone="overlay" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
