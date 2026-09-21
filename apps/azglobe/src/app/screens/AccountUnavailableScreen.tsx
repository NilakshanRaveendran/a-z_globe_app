import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomBar, Button, Screen, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { useSession } from '@app/providers/SessionProvider';
import { useAuthActions } from '@app/auth/useAuthActions';

/**
 * Shown when we are signed in but could not read which kind of account this is
 * — offline, or the profile read was refused.
 *
 * This state exists so the app never has to guess. The alternative, treating a
 * failed lookup as "no account yet", would drop a returning customer onto the
 * sign-up chooser and invite them to create a second, separate account; since
 * the two kinds are deliberately not interchangeable, that mistake is not one
 * they could undo. Waiting and retrying is always the better answer.
 */
export function AccountUnavailableScreen() {
  const { refreshUser } = useSession();
  const { signOut } = useAuthActions();
  const [retrying, setRetrying] = useState(false);

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="h1" color={colors.textHeading} align="center" style={styles.title}>
          Can&apos;t reach A-Z Globe
        </Text>
        <Text variant="bodyLg" color={colors.textSecondary} align="center">
          We couldn&apos;t load your account. Check your connection and try again — nothing has been
          lost.
        </Text>
      </View>

      <BottomBar>
        <Button
          label="Try again"
          loading={retrying}
          onPress={async () => {
            setRetrying(true);
            try {
              await refreshUser();
            } finally {
              setRetrying(false);
            }
          }}
        />
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing[4],
  },
  title: { marginBottom: spacing[1.5] },
});
