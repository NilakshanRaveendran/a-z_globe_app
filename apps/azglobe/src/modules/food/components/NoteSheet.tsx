import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button, Text } from '@core/ui';
import { Sheet } from '@core/ui/Sheet';
import { colors, radius, spacing, typography } from '@core/theme';

export const NOTE_MAX = 200;

/**
 * "Add note to restaurant" on Checkout (414:3339). The design has the row but
 * no editor, so this reuses the Write-a-Review sheet's textarea (426:3202):
 * r12 · #F9FAFB · 1px #E5E7EB, placeholder #9CA3AF, with an n/200 counter.
 *
 * The note travels on the order as `noteToRestaurant`, which the restaurant's
 * order card shows.
 */
export function NoteSheet({
  visible,
  value,
  onSave,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);

  // Closing with ✕ discards the edit; each opening starts from the saved note.
  useEffect(() => {
    if (visible) setDraft(value);
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Note to restaurant">
      <View style={styles.body}>
        <Text variant="bodyRegular" color={colors.textSecondary}>
          Allergies, spice level, or anything else the kitchen should know.
        </Text>
        <TextInput
          style={styles.textarea}
          placeholder="e.g. No onions, please. Extra napkins."
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          maxLength={NOTE_MAX}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          autoFocus
          accessibilityLabel="Note to restaurant"
        />
        <Text variant="bodySm" color={colors.textMuted} align="right" style={styles.counter}>
          {draft.length}/{NOTE_MAX}
        </Text>
        <Button
          label={draft.trim() || !value ? 'Save note' : 'Remove note'}
          onPress={() => {
            onSave(draft.trim());
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing[8], paddingTop: spacing[6] },
  textarea: {
    ...typography.body,
    color: colors.text,
    minHeight: 120,
    marginTop: spacing[5],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counter: { paddingTop: spacing[2.5], paddingBottom: spacing[6] },
});
