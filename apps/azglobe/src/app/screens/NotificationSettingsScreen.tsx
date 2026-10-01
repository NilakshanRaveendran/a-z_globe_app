import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Screen, ScreenHeader, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { createStorage } from '@core/storage';
import { useSession } from '@app/providers/SessionProvider';

const storage = createStorage({ id: 'azglobe.notificationPrefs' });

type Prefs = { orders: boolean; offers: boolean };
const DEFAULTS: Prefs = { orders: true, offers: true };

const ROWS: Array<{ key: keyof Prefs; title: string; subtitle: string }> = [
  { key: 'orders', title: 'Order updates', subtitle: 'When the restaurant accepts, prepares and sends your order' },
  { key: 'offers', title: 'Offers & promotions', subtitle: 'New deals and promo codes from restaurants near you' },
];

function readPrefs(uid: string): Prefs {
  try {
    const raw = storage.getString(uid);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * RN-web draws the "on" thumb in its own teal unless `activeThumbColor` is set;
 * the native Switch types do not know that prop, so it is passed only on web.
 */
const webThumb = Platform.OS === 'web' ? ({ activeThumbColor: colors.surface } as object) : {};

/**
 * Profile → Notifications. The design has the row (215:1152) but no screen, so
 * this is built from Profile's own settings rows: 15/22.5 600 title, 13/17.88
 * subtitle, 1px #F3F4F6 rules, with the brand-red switch.
 *
 * Choices are kept per account on this device.
 */
export function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const { user } = useSession();
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(user.uid));

  const toggle = (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    storage.set(user.uid, JSON.stringify(next));
  };

  return (
    <Screen>
      <ScreenHeader title="Notifications" onBack={navigation.goBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.flex}>
              <Text variant="settingsTitle" color={colors.text}>
                {row.title}
              </Text>
              <Text variant="settingsSubtitle" color={colors.textSecondary}>
                {row.subtitle}
              </Text>
            </View>
            <Switch
              accessibilityLabel={row.title}
              value={prefs[row.key]}
              onValueChange={(v) => toggle(row.key, v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.border}
              {...webThumb}
            />
          </View>
        ))}
        <Text variant="bodySm" color={colors.textMuted} style={styles.note}>
          Notifications arrive through the A-Z Globe mobile app. These choices are saved on
          this device.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing[8] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    padding: SCREEN_PADDING,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  flex: { flex: 1 },
  note: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[6] },
});
