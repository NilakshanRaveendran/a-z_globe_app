import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
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
  onSubmit: (rating: number, text: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const close = () => {
    setRating(0);
    setText('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={styles.body}>
        <Text variant="h2" color={colors.textHeading}>
          Write a Review
        </Text>
        <Text variant="bodyRegular" color={colors.textSecondary} style={styles.subtitle}>
          Share your experience at {merchantName}
        </Text>

        <Text variant="body" color={colors.palette.gray700} style={styles.label}>
          Your Rating
        </Text>
        <View style={styles.stars}>
          <StarRow rating={rating} size={32} gap={spacing[3]} onRate={setRating} />
        </View>

        <Text variant="body" color={colors.palette.gray700} style={styles.label}>
          Your Review
        </Text>
        <TextInput
          style={styles.textarea}
          placeholder="Tell others about your experience — food quality, delivery time, packaging…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={(next) => setText(next.slice(0, MAX_LENGTH))}
          multiline
          textAlignVertical="top"
        />
        <Text variant="bodySm" color={colors.textMuted} align="right" style={styles.counter}>
          {text.length}/{MAX_LENGTH}
        </Text>

        <Button
          label="Submit Review"
          disabled={rating === 0}
          onPress={() => {
            onSubmit(rating, text.trim());
            close();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing[8], paddingTop: spacing[8] },
  subtitle: { paddingTop: spacing[1.5] },
  label: { fontFamily: 'Urbanist_600SemiBold', paddingTop: spacing[8] },
  stars: { paddingTop: spacing[3.5] },
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
