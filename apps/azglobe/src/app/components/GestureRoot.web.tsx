import { View, type ViewProps } from 'react-native';

/**
 * Web: nothing in the app uses native gestures in the browser, and importing
 * react-native-gesture-handler there pulls Reanimated into the bundle with it.
 * A plain view stands in for its root.
 */
export function GestureRoot(props: ViewProps) {
  return <View {...props} />;
}
