import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StyleProp, ViewStyle } from 'react-native';
import { HeaderButton, type HeaderButtonTone } from '@core/ui';
import type { RootStackParamList } from '@app/navigation/types';


/** Opens the shared service notification inbox. */
export function OrdersBell({ tone, style }: { tone?: HeaderButtonTone; style?: StyleProp<ViewStyle> }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <HeaderButton
      icon="bell"
      tone={tone}
      style={style}
      label="Notifications"
      onPress={() => navigation.navigate('Notifications')}
    />
  );
}
