import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MAX_WIDTH, colors, fontFamily, radius, spacing } from '@core/theme';
import { Icon, StarRow, Text } from '@core/ui';
import { Alert } from '@core/ui/alert';
import { formatDate } from '@core/utils/datetime';
import { SupplierField } from './SupplierField';
import {
  REPLY_MAX_LENGTH,
  replyToReview,
  type MerchantReview,
  type ReviewReply,
} from '../services/reviews';

type Props = {
  /** The review being answered; the sheet is shown while this is set. */
  review: MerchantReview | null;
  merchantId: string;
  onClose: () => void;
  onSaved: (reviewId: string, reply: ReviewReply) => void;
};

/**
 * Reply to a review — opened from "Reply to this review" or "Edit Reply" on the
 * provider Reviews list (385:5924).
 *
 * Figma draws no composer, so this is built from the provider sheets' own
 * vocabulary (Add Restaurant 385:4028, Create Offer 374:5362):
 *
 *   panel   r24 top · #FFFFFF · 36×4 #E5E7EB grip, 12 from the top
 *   header  pad 14/20 · title 700 17/25.5 · "<name> · <dish>" 500 12/18
 *           #9CA3AF · 30pt #F3F4F6 round close
 *   quote   the review being answered, on the card's reply-box treatment:
 *           #F9FAFB · 0.51px #E5E7EB · r12 · pad 10/12
 *   field   SupplierField, multi-line, capped at 1000 characters (the rules'
 *           limit) with a live count
 *   footer  1px #F3F4F6 rule · pad 10/20 · 50h r14 #D42B2B, 700 15/22.5 white
 *
 * Closing with an unsent reply (or an unsaved edit) asks first.
 */
export function ReviewReplySheet({ review: open, merchantId, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  // The last review shown, kept while the sheet slides away so its content
  // does not blank out mid-animation.
  const [review, setReview] = useState<MerchantReview | null>(open);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(review?.reply);

  // Start from the current reply when editing, empty otherwise.
  useEffect(() => {
    if (!open) return;
    setReview(open);
    setText(open.reply?.text ?? '');
    setError(null);
    setBusy(false);
  }, [open]);

  const trimmed = text.trim();
  const unchanged = editing && trimmed === review?.reply?.text;
  const dirty = trimmed !== (review?.reply?.text ?? '').trim();

  // The scrim, ✕ and Android back all come here.
  const close = () => {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(editing ? 'Discard your changes?' : 'Discard this reply?', 'What you wrote will be lost.', [
      { text: 'Discard', style: 'destructive', onPress: onClose },
      { text: 'Keep writing', style: 'cancel' },
    ]);
  };
  const canSubmit = trimmed.length > 0 && trimmed.length <= REPLY_MAX_LENGTH && !unchanged && !busy;

  const submit = async () => {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      const reply = await replyToReview(merchantId, review.id, text);
      onSaved(review.id, reply);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Could not save your reply. Check your connection and try again.'
      );
      setBusy(false);
    }
  };

  const subtitle = review ? [review.userName, review.dishTag].filter(Boolean).join(' · ') : '';

  return (
    <Modal visible={open !== null} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />

        <View style={[styles.panel, { paddingBottom: spacing[12] + insets.bottom }]}>
          <View style={styles.gripRow}>
            <View style={styles.grip} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="h2" color={colors.text} style={styles.title}>
                {editing ? 'Edit Reply' : 'Reply to Review'}
              </Text>
              {subtitle ? (
                <Text variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Icon name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {review ? (
              <View style={styles.quote}>
                <View style={styles.quoteMeta}>
                  <StarRow rating={review.rating} size={16} />
                  <Text variant="captionRegular" color={colors.textMuted}>
                    {formatDate(review.createdAt)}
                  </Text>
                </View>
                <Text
                  variant="bodyRegular"
                  color={colors.palette.gray700}
                  numberOfLines={4}
                >
                  {review.text}
                </Text>
              </View>
            ) : null}

            <View>
              <SupplierField
                label="Your Reply"
                multiline
                value={text}
                onChangeText={setText}
                maxLength={REPLY_MAX_LENGTH}
                placeholder="Thank the customer, or answer their feedback…"
                style={styles.input}
                autoFocus
              />
              <Text
                variant="captionRegular"
                color={colors.textMuted}
                align="right"
                style={styles.count}
              >
                {`${text.length}/${REPLY_MAX_LENGTH}`}
              </Text>
            </View>

            <Text variant="microRegular" color={colors.textMuted}>
              Your reply is shown under the review as a response from your restaurant.
            </Text>

            {error ? (
              <Text variant="bodySm" color={colors.primary}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.cta,
                !canSubmit && styles.ctaDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="reply" size={16} color={colors.onPrimary} />
              <Text variant="h4" color={colors.onPrimary}>
                {busy ? 'Saving…' : editing ? 'Save Reply' : 'Post Reply'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Capped to the app's column and centred — see APP_MAX_WIDTH.
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: {
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['5xl'],
    borderTopRightRadius: radius['5xl'],
    maxHeight: '90%',
  },
  gripRow: { paddingTop: spacing[4], alignItems: 'center' },
  grip: { width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[8],
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, lineHeight: 25.5 },
  close: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: spacing[8], paddingBottom: spacing[9], gap: spacing[5] },
  quote: {
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    borderRadius: radius.xl,
    borderWidth: 0.51,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  quoteMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  input: { height: 120, fontFamily: fontFamily[500] },
  count: { marginTop: spacing[1.5] },
  footer: {
    paddingTop: spacing[3.5],
    paddingHorizontal: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  cta: {
    height: 50,
    flexDirection: 'row',
    gap: spacing[2.5],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  ctaDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
});
