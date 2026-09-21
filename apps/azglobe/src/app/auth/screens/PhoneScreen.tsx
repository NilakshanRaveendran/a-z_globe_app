import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { BottomBar, Button, Screen, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing, typography } from '@core/theme';
import { brandMark } from '@core/brand';
import { useAuthActions } from '../useAuthActions';
import type { AuthStackParamList } from '../types';

const DIAL_CODE = '+94';

/**
 * Phone entry.
 *
 * Figma has no auth screens, so this is composed from the design's own
 * vocabulary: the A-Z Globe mark, the Address-info field treatment (400:4244),
 * and the standard sticky CTA.
 */
export function PhoneScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { sendCode, busy, error, setError } = useAuthActions();
  const [digits, setDigits] = useState('');

  // Sri Lankan subscriber numbers are 9 digits after the dial code; users
  // habitually type the leading 0, so accept and strip it.
  const normalised = digits.replace(/\D/g, '').replace(/^0+/, '');
  const isValid = normalised.length === 9;

  const onContinue = async () => {
    const phone = `${DIAL_CODE}${normalised}`;
    if (await sendCode(phone)) navigation.navigate('Otp', { phone });
  };

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
          <Image
            source={brandMark}
            style={styles.brandMark}
            contentFit="contain"
          />

          <Text variant="h1" color={colors.textHeading} align="center" style={styles.title}>
            Welcome to A-Z Globe
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary} align="center">
            Enter your phone number and we&apos;ll text you a code to sign in.
          </Text>

          <View style={styles.field}>
            <Text variant="label" color={colors.palette.gray700}>
              Phone number
            </Text>
            <View style={[styles.inputRow, error && styles.inputRowError]}>
              <View style={styles.dial}>
                <Text variant="body" color={colors.text} style={styles.dialText}>
                  {DIAL_CODE}
                </Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="71 110 9390"
                placeholderTextColor="rgba(31,41,55,0.5)"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                maxLength={12}
                value={digits}
                onChangeText={(next) => {
                  setDigits(next);
                  setError(null);
                }}
              />
            </View>
            {error ? (
              <Text variant="bodySm" color={colors.primary}>
                {error}
              </Text>
            ) : null}
          </View>

          <Text variant="bodySm" color={colors.textMuted} align="center" style={styles.terms}>
            By continuing you agree to A-Z Globe&apos;s Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>

        <BottomBar>
          <Button label="Continue" onPress={onContinue} disabled={!isValid} loading={busy} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing[3],
  },
  brandMark: { alignSelf: 'center', width: 96, height: 96, marginBottom: spacing[8] },
  title: { fontSize: 26, lineHeight: 34 },

  field: { gap: spacing[2.5], paddingTop: spacing[9] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inputRowError: { borderColor: colors.primary },
  dial: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    backgroundColor: colors.surfaceAlt,
  },
  dialText: { fontFamily: 'Urbanist_600SemiBold' },
  input: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.text,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
  },
  terms: { paddingTop: spacing[8] },
});
