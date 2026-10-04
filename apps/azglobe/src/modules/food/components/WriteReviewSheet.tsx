import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, StarRow, Text } from '@core/ui';
import { Sheet } from '@core/ui/Sheet';
import { colors, radius, spacing, typography } from '@core/theme';

const MAX_LENGTH = 300;

/**
 * "Write a Review" sheet — Figma 426:3202.
 *
 *   title    "Write a Review" 18/27 + "Share your experience at <merchant>"
 *   rating   "Your Rating" 600 13/19.5 then five 32pt stars, gap 8
 *   body     textarea r12 · #F9FAFB · placeholder #9CA3AF, with an n/300 counter
 *   submit   disabled (and tinted back) until a rating is given
 */
export function WriteReviewSheet({
  visible,
  merchantName,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  merchantName: string;
  onClose: () => void;
  /**
   * Saves the review. The sheet stays open (with a spinner) until it settles,
   * and closes only on success — a rejected promise keeps what was typed.
   */
  onSubmit: (rating: number, text: string) => Promise<void> | void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setRating(0);
    setText('');
    onClose();
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit(rating, text.trim());
    } catch {
      // The caller reports the error; keep the draft so nothing is lost.
      setSaving(false);
      return;
    }
    setSaving(false);
    setRating(0);
    setText('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Write a Review">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text variant="bodyRegular" color={colors.textSecondary} style={styles.subtitle}>
          Share your experience at {merchantName}
        </Text>

        <View style={styles.stars}>
          <Text variant="labelLg" color={colors.textHeading}>Your Rating</Text>
          <StarRow rating={rating} size={32} gap={spacing[3]} onRate={setRating} />
        </View>

        <Text variant="body" color={colors.palette.gray700} style={styles.label}>
          Your Review
        </Text>
        <TextInput
          accessibilityLabel="Your review"
          style={styles.textarea}
          placeholder="Tell others about your experience — food quality, delivery time, packaging…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={(next) => setText(next.slice(0, MAX_LENGTH))}
          multiline
          textAlignVertical="top"
          editable={!saving}
        />
        <Text variant="bodySm" color={colors.textMuted} align="right" style={styles.counter}>
          {text.length}/{MAX_LENGTH}
        </Text>

        <Button label="Submit Review" disabled={rating === 0} loading={saving} onPress={submit} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[2] },
  subtitle: { paddingTop: spacing[1.5] },
  label: { fontFamily: 'Urbanist_600SemiBold', paddingTop: spacing[8] },
  stars: { marginTop: spacing[6], padding: spacing[5], gap: spacing[3], alignItems: 'center', borderRadius: radius.xl, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border },
  textarea: {
    ...typography.body,
    color: colors.text,
    minHeight: 120,
    marginTop: spacing[3.5],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counter: { paddingTop: spacing[2.5], paddingBottom: spacing[6] },
});
