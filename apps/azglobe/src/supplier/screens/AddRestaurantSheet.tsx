import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@core/theme';
import { Icon, Text } from '@core/ui';
import { SupplierField } from '../components/SupplierField';
import { createRestaurant, type Day, type NewRestaurant } from '../services/restaurants';

/**
 * Add Restaurant — Figma 385:4028 / 385:4261 / 385:4500 / 385:4762.
 *
 * The four-step sheet a supplier uses to put a restaurant on A-Z Globe. This is
 * where the catalogue comes from: nothing is seeded, so every restaurant a
 * customer browses was entered here by the business that runs it.
 *
 *   panel   r24 top · #FFFFFF · 36x4 grip
 *   header  pad 14/20 · title Urbanist 700 17/25.5 · "Step N of 4 · <name>"
 *           Urbanist 500 12/18 #9CA3AF · 30pt round close on #F3F4F6
 *   steps   four 4pt pills; the current one 24 wide #D42B2B, the done ones
 *           8 wide at 40% opacity, the rest #E5E7EB
 *   footer  1px #F3F4F6 rule · pad 10/20/32 · Back (outlined) + Next/Create
 */
const STEPS = ['Basic Info', 'Location', 'Hours', 'Orders'] as const;

const DAY_LABELS: Array<{ day: Day; label: string }> = [
  { day: 'mon', label: 'Mon' },
  { day: 'tue', label: 'Tue' },
  { day: 'wed', label: 'Wed' },
  { day: 'thu', label: 'Thu' },
  { day: 'fri', label: 'Fri' },
  { day: 'sat', label: 'Sat' },
  { day: 'sun', label: 'Sun' },
];

const PREP_TIMES = [
  { label: '10–15 min', min: 10, max: 15 },
  { label: '20–30 min', min: 20, max: 30 },
  { label: '30–45 min', min: 30, max: 45 },
  { label: '45–60 min', min: 45, max: 60 },
];

type Props = {
  visible: boolean;
  supplierUid: string;
  onClose: () => void;
  onCreated: (merchantId: string) => void;
};

export function AddRestaurantSheet({ visible, supplierUid, onClose, onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openTime, setOpenTime] = useState('7:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');
  const [closedDays, setClosedDays] = useState<Day[]>([]);
  // Figma draws the second chip selected.
  const [prepIndex, setPrepIndex] = useState(1);
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('150');

  const reset = () => {
    setStep(0);
    setError(null);
    setName('');
    setCuisines('');
    setTagline('');
    setAddress('');
    setPhone('');
    setClosedDays([]);
    setPrepIndex(1);
    setDeliveryAvailable(true);
    setDeliveryFee('150');
  };

  const close = () => {
    reset();
    onClose();
  };

  // Only the two starred fields gate progress, matching what Figma marks.
  const canAdvance = step === 0 ? name.trim().length >= 2 && cuisines.trim().length >= 2 : true;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const prep = PREP_TIMES[prepIndex] ?? PREP_TIMES[1]!;
      const input: NewRestaurant = {
        name,
        // "Sri Lankan · Authentic" — the separator Figma shows in the hint.
        cuisines: cuisines
          .split(/[·,]/)
          .map((c) => c.trim())
          .filter(Boolean),
        tagline,
        address,
        phone,
        openTime,
        closeTime,
        closedDays,
        prepTimeMin: prep.min,
        prepTimeMax: prep.max,
        deliveryAvailable,
        deliveryFee: Number(deliveryFee.replace(/[^\d]/g, '')) || 0,
      };
      const id = await createRestaurant(supplierUid, input);
      reset();
      onCreated(id);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('permission')
          ? 'Only a business account can add a restaurant.'
          : 'Could not create the restaurant. Check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />

        <View style={[styles.panel, { paddingBottom: spacing[12] + insets.bottom }]}>
          <View style={styles.gripRow}>
            <View style={styles.grip} />
          </View>

          <View style={styles.header}>
            <View>
              <Text variant="h2" color={colors.text}>
                Add Restaurant
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {`Step ${step + 1} of 4 · ${STEPS[step]}`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              style={styles.close}
            >
              <Icon name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.stepper}>
            {STEPS.map((label, i) => (
              <View
                key={label}
                style={[
                  styles.pip,
                  i === step && styles.pipCurrent,
                  i < step && styles.pipDone,
                ]}
              />
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 ? (
              <>
                <SupplierField
                  label="Restaurant Name"
                  required
                  invalid={!!name && name.trim().length < 2}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Mama's Kitchen"
                />
                <SupplierField
                  label="Cuisine / Category"
                  required
                  value={cuisines}
                  onChangeText={setCuisines}
                  placeholder="e.g. Sri Lankan · Authentic"
                />
                <SupplierField
                  label="Short Description"
                  multiline
                  value={tagline}
                  onChangeText={setTagline}
                  placeholder="Describe your restaurant in a few words…"
                />
              </>
            ) : step === 1 ? (
              <>
                <SupplierField
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. 42, Main Street, Trincomalee"
                />
                <SupplierField
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="e.g. +94 26 222 3456"
                />
                <View style={styles.note}>
                  <Icon name="mapPinSm" size={16} color="#16A34A" />
                  <Text variant="bodyRegular" color="#166534" style={styles.noteText}>
                    Map pin can be set after creation from Restaurant Info.
                  </Text>
                </View>
              </>
            ) : step === 2 ? (
              <>
                <View style={styles.row}>
                  <View style={styles.rowHalf}>
                    <SupplierField
                      label="Opening Time"
                      value={openTime}
                      onChangeText={setOpenTime}
                      placeholder="7:00 AM"
                    />
                  </View>
                  <View style={styles.rowHalf}>
                    <SupplierField
                      label="Closing Time"
                      value={closeTime}
                      onChangeText={setCloseTime}
                      placeholder="10:00 PM"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text variant="eyebrowSm" color={colors.textMuted}>
                    Closed On (select days)
                  </Text>
                  <View style={styles.chips}>
                    {DAY_LABELS.map(({ day, label }) => {
                      const on = closedDays.includes(day);
                      return (
                        <Pressable
                          key={day}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() =>
                            setClosedDays((prev) =>
                              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                            )
                          }
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text
                            variant="bodySm"
                            color={on ? colors.onPrimary : colors.textSecondary}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text variant="microRegular" color={colors.textMuted}>
                    These hours apply to all other days. You can fine-tune them later.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.field}>
                  <Text variant="eyebrowSm" color={colors.textMuted}>
                    Average Preparation Time
                  </Text>
                  <View style={styles.chips}>
                    {PREP_TIMES.map((p, i) => {
                      const on = i === prepIndex;
                      return (
                        <Pressable
                          key={p.label}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => setPrepIndex(i)}
                          style={[styles.chipLg, on && styles.chipOn]}
                        >
                          <Text
                            variant="body"
                            color={on ? colors.onPrimary : colors.textSecondary}
                          >
                            {p.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <Text variant="labelLg" color={colors.text}>
                      Delivery Available
                    </Text>
                    <Text variant="microRegular" color={colors.textMuted}>
                      Enable home delivery for customers
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: deliveryAvailable }}
                    onPress={() => setDeliveryAvailable((v) => !v)}
                    style={[styles.switch, deliveryAvailable && styles.switchOn]}
                  >
                    <View style={[styles.knob, deliveryAvailable && styles.knobOn]} />
                  </Pressable>
                </View>

                {deliveryAvailable ? (
                  <SupplierField
                    label="Delivery Fee"
                    value={deliveryFee}
                    onChangeText={setDeliveryFee}
                    keyboardType="number-pad"
                    placeholder="Rs. 150"
                  />
                ) : null}
              </>
            )}

            {error ? (
              <Text variant="bodySm" color={colors.primary} style={styles.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep((s) => s - 1)}
                style={[styles.cta, styles.ctaBack]}
              >
                <Icon name="chevronLeft" size={16} color={colors.palette.gray700} />
                <Text variant="labelLg" color={colors.palette.gray700}>
                  Back
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canAdvance || busy}
              onPress={() => (step === 3 ? void submit() : setStep((s) => s + 1))}
              style={[
                styles.cta,
                styles.ctaNext,
                step > 0 && styles.ctaNextNarrow,
                (!canAdvance || busy) && styles.ctaDisabled,
              ]}
            >
              {step === 3 ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
              <Text variant="h4" color={colors.onPrimary}>
                {step === 3 ? (busy ? 'Creating…' : 'Create Restaurant') : 'Next'}
              </Text>
              {step < 3 ? <Icon name="chevronRight" size={16} color={colors.onPrimary} /> : null}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: {
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
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[8],
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    gap: spacing[2.5],
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[6],
  },
  pip: { width: 8, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  pipCurrent: { width: 24, backgroundColor: colors.primary },
  pipDone: { backgroundColor: colors.primary, opacity: 0.4 },
  body: { paddingHorizontal: spacing[8], paddingBottom: spacing[9], gap: spacing[5] },
  field: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3] },
  rowHalf: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2.5] },
  chip: {
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  chipLg: {
    paddingVertical: spacing[3],
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  note: {
    flexDirection: 'row',
    gap: spacing[3.5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  noteText: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleText: { flex: 1, gap: spacing[0.5] },
  switch: { width: 44, height: 24, borderRadius: radius.pill, backgroundColor: colors.border, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.primary },
  knob: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginLeft: 3,
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px -1px rgba(0,0,0,0.10)',
  },
  knobOn: { marginLeft: 23 },
  error: { marginTop: spacing[3] },
  footer: {
    flexDirection: 'row',
    gap: spacing[3.5],
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
  },
  ctaBack: { width: 116, borderWidth: 1, borderColor: colors.border },
  ctaNext: { flex: 1, backgroundColor: colors.primary },
  ctaNextNarrow: { flex: 1 },
  ctaDisabled: { opacity: 0.5 },
});
