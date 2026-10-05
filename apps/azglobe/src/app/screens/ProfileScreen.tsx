import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@core/ui/alert';
import { Icon, Screen, showToast, Text, type IconName } from '@core/ui';
import { colors, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { useSession } from '@app/providers/SessionProvider';
import { useAuthActions } from '@app/auth/useAuthActions';
import type { RootStackParamList } from '@app/navigation/types';
import { useAddresses } from '@modules/food/hooks/useAddresses';
import { addressSubtitle, addressTitle } from '@modules/food/services/addresses';
import { addressIcon } from '@modules/food/components/AddressSearchSheet';

/**
 * Personal Profile — Figma 215:1152.
 *
 *   title    "Personal Profile" 700 24/36 + "Manage your Personal profile in here."
 *   identity 56pt red avatar (22.4 initial) · name 700 16/24 · phone / email
 *            500 13/19.5 #6B7280 · 18pt #D1D5DB chevron
 *   rows     pad 16 · gap 16 · 20pt #374151 glyph · 600 15/22.5 title ·
 *            500 13/17.88 subtitle · 1px #F3F4F6 rule
 *            Home address · My orders · "App Preferences" (700 17/25.5) · Notifications
 *   actions  "Switch to business account" (#D42B2B, store icon) · "Sign out"
 *   footer   version, bottom-left
 *
 * "My orders" is not in the frame; it is the only way back to past orders, so
 * it sits with the address as a plain settings row.
 *
 * "Switch to business account" signs out to the sign-in screen: a business is a
 * separate A-Z Globe account on its own number, never a mode of this one (see
 * @core/account), so switching means signing in as it. In the demo there is
 * nothing to sign out of, so it switches the demo account instead.
 */
export function ProfileScreen() {
  const { user, isDemo, switchDemoAccount } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuthActions();
  const { selected: address } = useAddresses();

  const doSignOut = async () => {
    try {
      // SessionProvider watches auth state, so a real sign-out swaps the whole
      // tree for the sign-in stack — no navigation needed here.
      const result = await signOut();
      if (result === 'demo') explainDemoSignOut();
    } catch {
      showToast("Couldn't sign out. Check your connection and try again.", { tone: 'error' });
    }
  };

  const confirmSignOut = () => {
    if (isDemo) {
      explainDemoSignOut();
      return;
    }
    Alert.alert(
      'Sign out?',
      "Your cart and delivery choices on this device will be cleared. You'll sign back in with your phone number.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void doSignOut() },
      ]
    );
  };

  const switchToBusiness = () => {
    if (isDemo) {
      switchDemoAccount('supplier');
      return;
    }
    Alert.alert(
      'Switch to business account',
      'Your business account is separate and signs in with your business phone number. Sign out of your personal account now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', onPress: () => void doSignOut() },
      ]
    );
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.titles}>
          <Text variant="display" color={colors.text}>
            Personal Profile
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            Manage your Personal profile in here.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit personal details, ${user.fullName}`}
          onPress={() => navigation.navigate('EditProfile')}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text variant="avatarInitial" color={colors.onPrimary}>
              {user.initial}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text variant="h3" color={colors.text}>
              {user.fullName}
            </Text>
            {user.phone ? (
              <Text variant="body" color={colors.textSecondary}>
                {user.phone}
              </Text>
            ) : null}
            {user.email ? (
              <Text variant="body" color={colors.textSecondary}>
                {user.email}
              </Text>
            ) : null}
          </View>
          <Icon name="chevronRight" size={18} color={colors.borderStrong} />
        </Pressable>

        <Row
          icon={address ? addressIcon(address.label) : 'house'}
          title={address ? addressTitle(address) : 'Delivery address'}
          subtitle={address ? addressSubtitle(address) : 'Add where your orders should go'}
          onPress={() =>
            navigation.navigate('Food', {
              screen: 'AddressInfo',
              params: address ? { addressId: address.id } : { label: 'Home' },
            })
          }
        />
        <Row
          icon="orderHistory"
          title="My orders"
          subtitle="Current and past orders"
          onPress={() => navigation.navigate('Food', { screen: 'MyOrders' })}
        />

        <Text variant="sectionTitle" color={colors.text} style={styles.sectionTitle}>
          App Preferences
        </Text>

        <Row
          icon="bell"
          title="Notifications"
          subtitle="Manage order and offer notifications"
          onPress={() => navigation.navigate('NotificationSettings')}
        />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to business account"
            onPress={switchToBusiness}
            style={({ pressed }) => [styles.actionRow, styles.actionDivider, pressed && styles.pressed]}
          >
            <Icon name="store" size={20} color={colors.primaryAccent} />
            <Text variant="settingsTitle" color={colors.primaryAccent} style={styles.flex}>
              Switch to business account
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          >
            <Text variant="settingsTitle" color={colors.status.danger}>
              Sign out
            </Text>
          </Pressable>
        </View>

        <Text variant="bodyRegular" color={colors.textMuted} style={styles.version}>
          v1.0.0
        </Text>
      </ScrollView>

    </Screen>
  );
}

function explainDemoSignOut() {
  Alert.alert(
    "Demo accounts can't sign out",
    'This demo runs without sign-in. Use "Switch to business account" to see the business side.'
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={colors.palette.gray700} />
      <View style={styles.flex}>
        <Text variant="settingsTitle" color={colors.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="settingsSubtitle" color={colors.textSecondary} numberOfLines={1} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={18} color={colors.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing[8] },
  titles: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[4], paddingBottom: spacing[6] },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    padding: SCREEN_PADDING,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.floating,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    padding: SCREEN_PADDING,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  rowSubtitle: { paddingTop: spacing[0.5] },
  sectionTitle: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[9], paddingBottom: spacing[3] },

  actions: { marginTop: spacing[6] },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    padding: SCREEN_PADDING,
  },
  actionDivider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  version: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[12] },

});
