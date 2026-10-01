import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { Icon, Screen, Text, showToast, type IconName } from '@core/ui';
import { Alert } from '@core/ui/alert';
import { colors, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import type { Merchant } from '@modules/food/types';
import { useSession } from '@app/providers/SessionProvider';
import { useAuthActions } from '@app/auth/useAuthActions';
import type { RootStackParamList, SupplierTabParamList } from '@app/navigation/types';
import { listOwnedRestaurants } from '../services/restaurants';

/**
 * Business Profile — Figma 147:4611.
 *
 *   title    "Business Profile" 700 24/36 #D42B2B · "Manage your Business
 *            profile in here." 500 14/21 #6B7280 · pad 12/16/16
 *   identity 97h · pad 16 · gap 16 · 1px #F3F4F6 rule · 56pt #D42B2B avatar
 *            (700 22.4 initial, drop shadow) · name 700 16/24 · phone and
 *            email 500 13/19.5 #6B7280 · 18pt #D1D5DB chevron
 *   rows     pad 16 · gap 16 · 1px #F3F4F6 rule · 20pt glyph · title 600
 *            15/22.5 · subtitle 500 13/17.9 #6B7280, 2 above · chevron
 *            "Home" address · "App Preferences" 700 17/25.5 (pad 24/16/8) ·
 *            Notifications
 *   actions  16 above · "Switch to personal account" (person glyph) 600
 *            15/22.5 #1F2937 · "Sign out" 600 15/22.5 #D42B2B
 *   footer   "v1.0.0" 400 12/18 #9CA3AF, pinned to the bottom
 *
 * "Home" is where the business is: its first restaurant's address (the one
 * the dashboard names), and tapping it opens that restaurant's information,
 * where the address is edited — pushed on this tab's own stack, so Back
 * returns here rather than to the Dashboard.
 *
 * "Sign out" asks first. The demo business has no account to sign out of, so
 * there the dialog says so and offers the personal demo account instead.
 */
export function SupplierProfileScreen() {
  const { user, isDemo, switchDemoAccount, location, businessName, businessContact } = useSession();
  const { signOut } = useAuthActions();
  const navigation = useNavigation<NavigationProp<SupplierTabParamList & RootStackParamList>>();
  const [primary, setPrimary] = useState<Merchant | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      listOwnedRestaurants(user.uid)
        .then((owned) => live && setPrimary(owned[0] ?? null))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [user.uid])
  );

  // Signing out swaps the whole tree for the sign-in stack (SessionProvider
  // watches auth state). The demo has no sign-in to go back to, and says so.
  const runSignOut = async () => {
    try {
      const result = await signOut();
      if (result === 'demo') {
        Alert.alert(
          'The demo stays signed in',
          'This demo business account has no sign-in behind it, so there is nothing to sign out of. You can switch to the personal demo account instead.',
          [
            { text: 'Switch to personal account', onPress: () => switchDemoAccount('customer') },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
    } catch {
      showToast('Could not sign out. Check your connection and try again.', { tone: 'error' });
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'To sign in again you’ll need your business phone number and a verification code.', [
      { text: 'Sign out', style: 'destructive', onPress: () => void runSignOut() },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const switchAccount = () => {
    if (isDemo) return switchDemoAccount('customer');
    Alert.alert('Switch to personal account', 'Sign out and sign in with your personal phone number?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void runSignOut() },
    ]);
  };

  const openHome = () =>
    primary
      ? navigation.navigate('SupplierRestaurantInfo', { merchantId: primary.id })
      : // No restaurant yet: its address is entered when one is added.
        navigation.navigate('Home', { screen: 'SupplierRestaurants', initial: false });

  const openAccount = () => navigation.navigate('EditProfile');

  const openNotifications = () =>
    navigation.navigate('ComingSoon', {
      title: 'Notifications',
      message:
        'Push and email alerts for new orders are coming. Until then, new orders appear on the Orders tab.',
      actionLabel: 'Back to Profile',
    });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text variant="display" color={colors.primary}>
            Business Profile
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            Manage your Business profile in here.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${user.fullName}, edit business profile`}
          onPress={openAccount}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text variant="avatarInitial" color={colors.onPrimary}>
              {user.initial}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text variant="h3" color={colors.text} numberOfLines={1}>
              {user.fullName}
            </Text>
            {businessName ? (
              <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                {businessName}
              </Text>
            ) : null}
            {businessContact?.phone || businessContact?.email ? (
              <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                {[businessContact.phone, businessContact.email].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <Icon name="chevronRight" size={18} color={colors.borderStrong} />
        </Pressable>

        <SettingsRow
          icon="home"
          title="Home"
          subtitle={primary?.address || location}
          onPress={openHome}
        />

        <Text variant="sectionTitle" color={colors.text} style={styles.section}>
          App Preferences
        </Text>

        <SettingsRow
          icon="bell"
          title="Notifications"
          subtitle="Manage push and email notifications"
          onPress={openNotifications}
        />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch to personal account"
            onPress={switchAccount}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Icon name="person" size={20} color={colors.text} />
            <Text variant="settingsTitle" color={colors.text}>
              Switch to personal account
            </Text>
          </Pressable>
          {/* SessionProvider watches auth state, so signing out swaps the whole
              tree for the sign-in stack — no navigation needed here. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.row, styles.rowBare, pressed && styles.pressed]}
          >
            <Text variant="settingsTitle" color={colors.primary}>
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

function SettingsRow({
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
        <Text variant="settingsSubtitle" color={colors.textSecondary} numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: colors.surfaceSunken },
  heading: {
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    paddingHorizontal: SCREEN_PADDING,
  },
  identity: {
    minHeight: 97,
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
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.avatar,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    padding: SCREEN_PADDING,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  rowBare: { borderBottomWidth: 0 },
  subtitle: { marginTop: spacing[0.5] },
  section: {
    paddingTop: spacing[9],
    paddingBottom: spacing[3],
    paddingHorizontal: SCREEN_PADDING,
  },
  actions: { paddingTop: spacing[6] },
  version: {
    marginTop: 'auto',
    paddingTop: spacing[6],
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing[3],
  },
});
