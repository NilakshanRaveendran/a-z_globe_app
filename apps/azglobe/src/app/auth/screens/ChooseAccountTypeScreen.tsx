import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BottomBar, Button, Screen, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import type { AccountKind } from '@core/account';
import { useSession } from '@app/providers/SessionProvider';
import { useAuthActions } from '../useAuthActions';

/**
 * Which kind of account this number is signing up as.
 *
 * A-Z Globe is one app serving two audiences. A person ordering dinner and a
 * business taking those orders need different screens, different permissions
 * and different data — so they are separate accounts, on separate Firebase
 * uids, and this is where a brand-new number picks its side.
 *
 * It is asked, not inferred, because the choice is not reversible for a uid:
 * `ensureAccount` and `firestore.rules` both refuse a uid that already holds
 * one kind from taking the other. Someone who wants both holds two accounts on
 * two numbers — which is the point, since it lets them hand the business
 * account to staff without handing over their personal one.
 *
 * Returning accounts never see this screen: SessionProvider resolves the kind
 * from the uid and routes straight past it.
 */
const OPTIONS: Array<{ kind: AccountKind; title: string; blurb: string }> = [
  {
    kind: 'customer',
    title: 'Personal account',
    blurb: 'Order food and book services on A-Z Globe.',
  },
  {
    kind: 'supplier',
    title: 'Business account',
    blurb: 'Run your restaurant — manage your menu, orders and offers.',
  },
];

export function ChooseAccountTypeScreen() {
  const { createAccount, busy, error } = useAuthActions();
  const { refreshUser } = useSession();
  const [kind, setKind] = useState<AccountKind>('customer');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1" color={colors.textHeading} style={styles.title}>
          How will you use A-Z Globe?
        </Text>
        <Text variant="bodyLg" color={colors.textSecondary}>
          You can change this later only by signing up again with a different
          number, so pick the one you need now.
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = option.kind === kind;
            return (
              <Pressable
                key={option.kind}
                onPress={() => setKind(option.kind)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.optionText}>
                  <Text variant="h5" color={colors.textHeading}>
                    {option.title}
                  </Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {option.blurb}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text variant="bodySm" color={colors.primary} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <BottomBar>
        <Button
          label="Continue"
          loading={busy}
          onPress={async () => {
            // Writing the account document is what makes the kind real. The
            // session then re-resolves it and moves on to the profile step.
            if (await createAccount(kind)) await refreshUser();
          }}
        />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing[6], gap: spacing[1.5] },
  title: { marginBottom: spacing[1.5] },
  options: { marginTop: spacing[6], gap: spacing[4] },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
    padding: spacing[6],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[0.5],
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionText: { flex: 1, gap: spacing[1] },
  error: { marginTop: spacing[4] },
});
