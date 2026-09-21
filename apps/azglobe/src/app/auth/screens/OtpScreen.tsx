import { useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { BottomBar, Button, Icon, Screen, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing, typography } from '@core/theme';
import { useAuthActions } from '../useAuthActions';
import type { AuthStackParamList } from '../types';

const LENGTH = 6;
const RESEND_SECONDS = 45;

/**
 * OTP entry.
 *
 * Six boxes styled like the design's option buttons (116:3078): r12, 1.63px
 * border, #FFF1F1 + #D42B2B when filled. A single hidden TextInput backs them,
 * which keeps SMS autofill working — per-box inputs break it.
 */
export function OtpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { params } = useRoute<RouteProp<AuthStackParamList, 'Otp'>>();
  const { confirmCode, sendCode, busy, error, setError } = useAuthActions();

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const submit = async (value: string) => {
    if (await confirmCode(value)) navigation.replace('CompleteProfile');
  };

  const onChange = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    setError(null);
    // Autofilled codes arrive complete; submit without a second tap.
    if (digits.length === LENGTH) void submit(digits);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={navigation.goBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Icon name="arrowLeft" size={18} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="h1" color={colors.textHeading} style={styles.title}>
            Verify your number
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            We sent a {LENGTH}-digit code to {params.phone}.
          </Text>

          <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: LENGTH }).map((_, i) => {
              const char = code[i];
              const active = i === code.length;
              return (
                <View
                  key={i}
                  style={[styles.box, char ? styles.boxFilled : active ? styles.boxActive : null]}
                >
                  <Text variant="h2" color={char ? colors.primary : colors.textMuted} align="center">
                    {char ?? ''}
                  </Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={LENGTH}
            autoFocus
          />

          {error ? (
            <Text variant="bodySm" color={colors.primary} align="center">
              {error}
            </Text>
          ) : null}

          <View style={styles.resendRow}>
            {secondsLeft > 0 ? (
              <Text variant="bodyLg" color={colors.textMuted}>
                Resend code in {secondsLeft}s
              </Text>
            ) : (
              <Pressable
                onPress={async () => {
                  if (await sendCode(params.phone)) setSecondsLeft(RESEND_SECONDS);
                }}
                hitSlop={8}
              >
                <Text variant="h5" color={colors.primary}>
                  Resend code
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        <BottomBar>
          <Button
            label="Verify"
            onPress={() => submit(code)}
            disabled={code.length !== LENGTH}
            loading={busy}
          />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing[4] },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.7 },

  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[6], gap: spacing[3] },
  title: { fontSize: 26, lineHeight: 34 },

  boxes: { flexDirection: 'row', gap: spacing[3], paddingTop: spacing[9] },
  box: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1.63,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  boxActive: { borderColor: colors.borderStrong },
  boxFilled: { borderColor: colors.primary, backgroundColor: colors.primaryTint },

  // Off-screen rather than display:none — a hidden input cannot take focus,
  // and focus is what drives both the keyboard and SMS autofill.
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
    ...typography.body,
  },

  resendRow: { alignItems: 'center', paddingTop: spacing[8] },
});
