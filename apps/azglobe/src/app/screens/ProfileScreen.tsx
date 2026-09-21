import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Screen, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { useSession } from '@app/providers/SessionProvider';
import { useAuthActions } from '@app/auth/useAuthActions';
import type { RootStackParamList } from '@app/navigation/types';
import { useAddresses } from '@modules/food/hooks/useAddresses';
import { addressSubtitle, addressTitle } from '@modules/food/services/addresses';

/**
 * Personal Profile — Figma 215:1152.
 *
 *   title    "Personal Profile" ~26/700 + "Manage your Personal profile in here."
 *   identity 64pt red avatar with the initial, name / phone / email, chevron
 *   rows     Home address · "App Preferences" heading · Notifications
 *   actions  "Switch to business account" (#D42B2B, store icon) · "Sign out"
 *   footer   version, bottom-left
 *
 * The address row is the customer's real saved address (or a prompt to add
 * one). "Switch to business account" signs out to the sign-in screen: a
 * business is a separate A-Z Globe account on its own number, never a mode of
 * this one (see @core/account), so switching means signing in as it.
 */
export function ProfileScreen() {
  const { user } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuthActions();
  const { selected: address } = useAddresses();

  const switchToBusiness = () =>
    Alert.alert(
      'Switch to business account',
      'Your business account is separate and signs in with your business phone number. Sign out of your personal account now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', onPress: () => void signOut() },
      ]
    );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.titles}>
          <Text variant="h1" color={colors.textHeading} style={styles.title}>
            Personal Profile
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            Manage your Personal profile in here.
          </Text>
        </View>

        <Pressable style={({ pressed }) => [styles.identity, pressed && styles.pressed]}>
          <View style={styles.avatar}>
            <Text variant="h1" color={colors.onPrimary}>
              {user.initial}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text variant="h3" color={colors.textStrong}>
              {user.fullName}
            </Text>
            <Text variant="bodyLg" color={colors.textSecondary}>
              {user.phone}
            </Text>
            <Text variant="bodyLg" color={colors.textSecondary}>
              {user.email}
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.textMuted} />
        </Pressable>

        <Row
          icon="mapPin"
          title={address ? addressTitle(address) : 'Delivery address'}
          subtitle={address ? addressSubtitle(address) : 'Add where your orders should go'}
          onPress={() =>
            navigation.navigate('Food', {
              screen: 'AddressInfo',
              params: address ? { addressId: address.id } : { label: 'Home' },
            })
          }
        />

        <Text variant="h3" color={colors.textStrong} style={styles.sectionTitle}>
          App Preferences
        </Text>

        <Row
          icon="bell"
          title="Notifications"
          subtitle="Manage push and email notifications"
        />

        <Pressable
          onPress={switchToBusiness}
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
        >
          <Icon name="store" size={20} color={colors.primary} />
          <Text variant="h4" color={colors.primary} style={styles.flex}>
            Switch to business account
          </Text>
        </Pressable>

        {/* SessionProvider watches auth state, so signing out swaps the whole
            tree for the sign-in stack — no navigation needed here. */}
        <Pressable
          onPress={signOut}
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
        >
          <Text variant="h4" color={colors.primary}>
            Sign out
          </Text>
        </Pressable>

        <Text variant="bodySm" color={colors.textMuted} style={styles.version}>
          v1.0.0
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: 'mapPin' | 'bell';
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Icon name={icon} size={20} color={colors.text} />
      <View style={styles.flex}>
        <Text variant="h4" color={colors.textStrong}>
          {title}
        </Text>
        <Text variant="bodyLg" color={colors.textSecondary}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing[8] },
  titles: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[5], gap: spacing[1.5] },
  title: { fontSize: 26, lineHeight: 34 },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[8],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing[6],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[8], paddingBottom: spacing[2] },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  version: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[12] },
});
