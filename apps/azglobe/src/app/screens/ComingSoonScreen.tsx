import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { Button, Screen, ScreenHeader, Text } from '@core/ui';
import { colors, spacing } from '@core/theme';
import type { RootStackParamList } from '@app/navigation/types';

/**
 * Placeholder for the A-Z modules that are not built yet.
 *
 * The Figma Home screen shows all six service tiles, so they all stay tappable;
 * the five that have no module land here instead of doing nothing.
 *
 * The copy below is the customer's. A caller for whom it is wrong — the
 * business dashboard's bell and service toggles — passes `message` and
 * `actionLabel` instead.
 */
export function ComingSoonScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ComingSoon'>>();

  return (
    <Screen>
      <ScreenHeader title={params.title} onBack={navigation.goBack} />
      <View style={styles.body}>
        <Text style={styles.glyph}>🚧</Text>
        <Text variant="h2" color={colors.textStrong} align="center">
          {params.title} is on the way
        </Text>
        <Text variant="bodyLg" color={colors.textSecondary} align="center">
          {params.message ?? 'This A-Z Globe service is not open yet. Order Food is available today.'}
        </Text>
        <Button
          label={params.actionLabel ?? 'Back to Home'}
          onPress={navigation.goBack}
          fullWidth={false}
          style={styles.cta}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[12],
  },
  glyph: { fontSize: 56, lineHeight: 64, marginBottom: spacing[4] },
  cta: { paddingHorizontal: spacing[9], marginTop: spacing[6] },
});
