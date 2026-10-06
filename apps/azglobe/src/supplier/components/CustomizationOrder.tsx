import { useMemo } from 'react';
import { PanResponder, View } from 'react-native';
import { Text } from '@core/ui';
import { colors } from '@core/theme';
import type { CustomizationOrderProps } from './CustomizationOrder.types';
/** Drag a handle to move nearby; explicit move actions remain available for accessibility. */
export function CustomizationOrder({ index, onReorder, disabled, children }: CustomizationOrderProps) {
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderRelease: (_, gesture) => {
      const offset = Math.round(gesture.dy / 60);
      if (offset) onReorder(index, index + offset);
    },
  }), [index, onReorder, disabled]);
  return <View>{children(<View {...pan.panHandlers} accessibilityLabel="Drag to reorder" style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text color={colors.textMuted} style={{ fontSize: 24 }}>≡</Text></View>)}</View>;
}
