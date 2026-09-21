import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { BottomBar, Button, Screen, Text } from '@core/ui';
import { Field } from '@core/ui/Field';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { useSession } from '@app/providers/SessionProvider';
import { useAuthActions } from '../useAuthActions';

/**
 * Profile completion — the last step after OTP.
 *
 * The copy follows the account kind, because the two are asking for different
 * things: a customer gives their own name, a supplier gives the BUSINESS name
 * that diners will see on the restaurant card. Getting that distinction right
 * is the visible half of keeping the two identities separate.
 *
 * The name feeds the Home greeting ("Good evening, Vanan") and the Profile
 * screen's avatar initial, both of which the design depends on, so it is
 * required. Email is optional, matching the Profile screen where it simply sits
 * under the phone number.
 *
 * There is no navigation away from here: once the profile is written,
 * SessionProvider sees a complete account and swaps the auth stack for the
 * experience that account's kind gets.
 */
const COPY = {
  customer: {
    title: 'Tell us about you',
    blurb: "We'll use this on your orders and your profile.",
    nameLabel: 'Your name',
    namePlaceholder: 'e.g. Vanan',
    emailPlaceholder: 'you@example.com',
  },
  supplier: {
    title: 'Tell us about your business',
    blurb: 'This is what customers will see on A-Z Globe.',
    nameLabel: 'Business name',
    namePlaceholder: "e.g. Mama's Kitchen",
    emailPlaceholder: 'hello@yourbusiness.lk',
  },
} as const;

export function CompleteProfileScreen() {
  const { completeProfile, busy, error } = useAuthActions();
  const { refreshUser, accountKind } = useSession();
  // By this point the account exists, so the kind is known; default defensively
  // rather than rendering a blank screen if it somehow is not.
  const copy = COPY[accountKind ?? 'customer'];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const trimmed = name.trim();
  const emailLooksValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = trimmed.length >= 2 && emailLooksValid;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="h1" color={colors.textHeading} style={styles.title}>
            {copy.title}
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            {copy.blurb}
          </Text>

          <View style={styles.fields}>
            <Field
              label={copy.nameLabel}
              placeholder={copy.namePlaceholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Field
              label="Email (optional)"
              placeholder={copy.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {email && !emailLooksValid ? (
              <Text variant="bodySm" color={colors.primary}>
                That email does not look right.
              </Text>
            ) : null}
            {error ? (
              <Text variant="bodySm" color={colors.primary}>
                {error}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <BottomBar>
          <Button
            label="Get started"
            onPress={async () => {
              // updateProfile fires no auth-state event, so the session has to
              // be re-read before the shell will swap in the app.
              if (await completeProfile(accountKind ?? 'customer', trimmed, email.trim())) await refreshUser();
            }}
            disabled={!canSubmit}
            loading={busy}
          />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[9],
    gap: spacing[3],
  },
  title: { fontSize: 26, lineHeight: 34 },
  fields: { paddingTop: spacing[9], gap: spacing[6] },
});
