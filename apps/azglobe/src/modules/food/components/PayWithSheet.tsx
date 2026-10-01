import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from '@core/ui';
import { Sheet } from '@core/ui/Sheet';
import { colors, radius, spacing } from '@core/theme';

export type PaymentMethod = { id: string; label: string; kind: 'card' | 'cod' };

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'visa-7309', label: 'Visa ••••7309', kind: 'card' },
  { id: 'cod', label: 'Cash on delivery', kind: 'cod' },
];

/**
 * "Pay with" sheet — Figma 416:3862.
 *
 *   header   "Pay with" 17/25.5 with a close button
 *   methods  rows pad 14v, 1px #F3F4F6 rule, 40pt icon well (r10) + label
 *            600 14/21, 22pt radio; selected = filled #D42B2B with a white tick
 *   add      "+ Add payment method" in a neutral well
 *   vouchers "Vouchers" heading with a "See details" pill, then "Add voucher code"
 *   footer   "Confirm"
 *
 * Saved cards and vouchers have no backend yet, so their rows are drawn as
 * the design has them but marked "Coming soon" and inert — nothing here looks
 * tappable without doing something. (A toast would not help: it renders
 * beneath the sheet's modal.) Promo codes live in the cart.
 */
export function PayWithSheet({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(selectedId);

  // Closing with ✕ discards an unconfirmed choice: each opening starts from
  // the method checkout is actually using.
  useEffect(() => {
    if (visible) setPending(selectedId);
  }, [visible, selectedId]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Pay with">
      <View style={styles.body}>
        <Text variant="h4" color={colors.text} style={styles.heading}>
          Payment methods
        </Text>

        <View>
          {PAYMENT_METHODS.map((method) => {
            const selected = method.id === pending;
            return (
              <Pressable
                key={method.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPending(method.id)}
                style={styles.methodRow}
              >
                <View style={styles.methodLeft}>
                  <View style={[styles.well, method.kind === 'card' ? styles.wellCard : styles.wellCod]}>
                    {method.kind === 'card' ? (
                      <Text variant="labelSm" color={colors.onPrimary} style={styles.visa}>
                        VISA
                      </Text>
                    ) : (
                      <Icon name="cash" size={22} color="#16A34A" />
                    )}
                  </View>
                  <Text variant="labelLg" color={colors.text}>
                    {method.label}
                  </Text>
                </View>

                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <Icon name="check" size={11} color={colors.onPrimary} /> : null}
                </View>
              </Pressable>
            );
          })}

          <ComingSoonRow label="Add payment method" />
        </View>

        <View style={styles.vouchersHead}>
          <Text variant="h4" color={colors.text}>
            Vouchers
          </Text>
          <View style={styles.seeDetails}>
            <Text variant="label" color={colors.textMuted}>
              Coming soon
            </Text>
          </View>
        </View>

        <ComingSoonRow label="Add voucher code" last />

        <Button
          label="Confirm"
          onPress={() => {
            onSelect(pending);
            onClose();
          }}
          style={styles.confirm}
        />
      </View>
    </Sheet>
  );
}

/** A row the design draws but the app cannot do yet — muted, inert, and says so. */
function ComingSoonRow({ label, last }: { label: string; last?: boolean }) {
  return (
    <View
      accessible
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${label}, coming soon`}
      style={[styles.methodRow, last && styles.lastRow]}
    >
      <View style={[styles.methodLeft, styles.soon]}>
        <View style={[styles.well, styles.wellNeutral]}>
          <Icon name="plus" size={18} color={colors.textMuted} />
        </View>
        <View>
          <Text variant="labelLg" color={colors.textSecondary}>
            {label}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            Coming soon
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing[8], paddingTop: spacing[1.5] },
  heading: { paddingTop: spacing[8], paddingBottom: spacing[1.5] },

  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[5] },
  soon: { opacity: 0.7 },
  lastRow: { borderBottomWidth: 0 },
  well: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  wellCard: { backgroundColor: '#1A1F71' },
  wellCod: { backgroundColor: '#DCFCE7' },
  wellNeutral: { backgroundColor: colors.surfaceAlt },
  visa: { fontFamily: 'Urbanist_700Bold', fontSize: 10 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.53,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  vouchersHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[8],
    paddingBottom: spacing[1.5],
  },
  seeDetails: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  confirm: { marginTop: spacing[8] },
});
