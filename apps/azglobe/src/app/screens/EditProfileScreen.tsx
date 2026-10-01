import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { BottomBar, Button, Icon, Screen, ScreenHeader, showToast, Text } from '@core/ui';
import { Field } from '@core/ui/Field';
import { colors, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { firstGrapheme } from '@core/utils/text';
import { useSession } from '@app/providers/SessionProvider';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s-]{7,16}$/;

/**
 * Edit Profile — opened from the identity row on Personal Profile and on
 * Business Profile.
 *
 *   customer  "Personal Details": name · email · phone
 *   business  "Business Profile": your name · business name · business email ·
 *             business phone
 *
 * The avatar initial follows the name as it is typed. A customer's phone is
 * the number they sign in with, so with real sign-in it is shown but changed
 * only by verifying a new number (not here); the demo lets it be edited.
 */
export function EditProfileScreen() {
  const navigation = useNavigation();
  const { user, isDemo, accountKind, businessName, businessContact, updateProfile } = useSession();
  const business = accountKind === 'supplier';
  const phoneLocked = !business && !isDemo;

  const [name, setName] = useState(user.fullName);
  const [company, setCompany] = useState(businessName ?? '');
  // A business edits its own contact details, never the owner's sign-in number.
  const [email, setEmail] = useState(business ? (businessContact?.email ?? '') : user.email);
  const [phone, setPhone] = useState(business ? (businessContact?.phone ?? '') : user.phone);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = {
    name: name.trim().length < 2 ? 'Enter your name (at least 2 letters).' : null,
    company: business && company.trim().length < 2 ? 'Enter the business name.' : null,
    email: email.trim() && !EMAIL.test(email.trim()) ? 'That email does not look right.' : null,
    phone: !phoneLocked && phone.trim() && !PHONE.test(phone.trim()) ? 'Enter a phone number, e.g. 071 234 5678.' : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (e: string | null) =>
    attempted && e ? (
      <Text variant="bodySm" color={colors.primary}>
        {e}
      </Text>
    ) : null;

  const save = async () => {
    setAttempted(true);
    if (invalid) return;
    setSaving(true);
    setFailure(null);
    try {
      await updateProfile({ fullName: name, email, phone, ...(business ? { businessName: company } : {}) });
      showToast(business ? 'Business profile updated' : 'Profile updated');
      navigation.goBack();
    } catch (e) {
      setFailure(e instanceof Error && e.message ? e.message : 'Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const initial = firstGrapheme(name.trim()).toLocaleUpperCase() || user.initial;

  return (
    <Screen>
      <ScreenHeader title={business ? 'Business Profile' : 'Personal Details'} onBack={navigation.goBack} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text variant="avatarInitial" color={colors.onPrimary}>
                {initial}
              </Text>
            </View>
            <Text variant="h3" color={colors.text} numberOfLines={1}>
              {name.trim() || 'Your name'}
            </Text>
            {business && company.trim() ? (
              <Text variant="body" color={colors.textSecondary} numberOfLines={1}>
                {company.trim()}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text variant="eyebrowSm" color={colors.textMuted}>
              {business ? 'YOU' : 'PERSONAL DETAILS'}
            </Text>
            <Field
              label="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Your name"
              maxLength={60}
            />
            {show(errors.name)}
            {business ? null : (
              <>
                <Field
                  label="Email (optional)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                />
                {show(errors.email)}
                <Field
                  label="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="071 234 5678"
                  editable={!phoneLocked}
                  style={phoneLocked ? styles.locked : undefined}
                />
                {phoneLocked ? (
                  <View style={styles.hint}>
                    <Icon name="warning" size={13} color={colors.textMuted} />
                    <Text variant="bodySm" color={colors.textMuted} style={styles.flex}>
                      This is the number you sign in with. Changing it needs a new verification code.
                    </Text>
                  </View>
                ) : (
                  show(errors.phone)
                )}
              </>
            )}
          </View>

          {business ? (
            <View style={styles.card}>
              <Text variant="eyebrowSm" color={colors.textMuted}>
                BUSINESS
              </Text>
              <Field
                label="Business name"
                value={company}
                onChangeText={setCompany}
                autoCapitalize="words"
                placeholder="e.g. Vanan Foods (Pvt) Ltd"
                maxLength={80}
              />
              {show(errors.company)}
              <Field
                label="Business email (optional)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="orders@yourbusiness.lk"
              />
              {show(errors.email)}
              <Field
                label="Business phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="026 222 3456"
              />
              {show(errors.phone)}
              <Text variant="bodySm" color={colors.textMuted}>
                Restaurant names, addresses and hours are edited on each restaurant’s information page.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <BottomBar>
          {failure ? (
            <Text variant="bodySm" color={colors.primary} style={styles.failure}>
              {failure}
            </Text>
          ) : null}
          <Button label="Save Changes" onPress={() => void save()} loading={saving} disabled={saving} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SCREEN_PADDING, gap: spacing[6], paddingBottom: spacing[9] },
  identity: { alignItems: 'center', gap: spacing[1.5], paddingVertical: spacing[4] },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing[3],
    ...shadows.floating,
  },
  card: {
    gap: spacing[5],
    padding: spacing[6],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  locked: { backgroundColor: colors.surfaceAlt, color: colors.textSecondary },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  failure: { marginBottom: spacing[3] },
});
