import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MAX_WIDTH, colors, duration, fontFamily, radius, shadows, spacing, typography } from '@core/theme';
import { Icon, Text } from '@core/ui';
import { Alert } from '@core/ui/alert';
import { isFirebaseReady } from '@core/firebase';
import { SupplierField } from '../components/SupplierField';
import { createRestaurant, type Day, type NewRestaurant } from '../services/restaurants';
import {
  hoursNote,
  invalidRestaurantFields,
  normaliseTime,
  parseDeliveryFee,
  RESTAURANT_FIELD_MESSAGES,
  restaurantStepErrors,
  type RestaurantField,
} from '../services/restaurantValidation';

/**
 * Add Restaurant — Figma 385:4028 / 385:4261 / 385:4500 / 385:4762.
 *
 * The four-step sheet a supplier uses to put a restaurant on A-Z Globe. This is
 * where the catalogue comes from: nothing is seeded, so every restaurant a
 * customer browses was entered here by the business that runs it.
 *
 *   panel   r24 top · #FFFFFF · 36x4 #E5E7EB grip, 12 from the top
 *   header  pad 14/20 · "Add Restaurant" Urbanist 700 17/25.5 #1F2937 ·
 *           "Step N of 4 · <name>" 500 12/18 #9CA3AF · 30pt #F3F4F6 close
 *           circle with a 14pt #6B7280 cross
 *   steps   pad 0/20/16 · gap 6 · 4pt pills: current 24 wide #D42B2B, done
 *           8 wide #D42B2B at 40%, the rest 8 wide #E5E7EB
 *   body    pad 0/20/24 · gap 14 (16 on step 4) · labels are the tracked
 *           uppercase eyebrow (700 10/15 ls0.55 #9CA3AF), 8 above the box
 *   step 2  green note: #F0FDF4 · 0.51 #BBF7D0 · r12 · pad 12 · gap 10 ·
 *           16pt #16A34A pin · 400 12/18 #166534
 *   step 3  two time boxes (h42.5, pad 11/12, 600 13/19.5) with a 10 gap;
 *           day chips h33 · pad 7/12 · r10 · #F3F4F6 · 600 12/18 #6B7280 ·
 *           gap 8; helper 400 11/16.5 #9CA3AF
 *   step 4  prep chips h36.5 · pad 8/14 · r10 · 600 13/19.5, selected #D42B2B;
 *           "Delivery Available" card 0.51 #E5E7EB · r12 · pad 12/14 with a
 *           44x24 toggle (18pt knob)
 *   footer  0.51 #F3F4F6 rule · pad 10/20/32 · gap 10 · h50 r14 buttons:
 *           "Back" outlined (0.51 #E5E7EB, 600 14/21 #374151) and the red
 *           "Next ›" / "✓ Create Restaurant" (700 15/22.5), 115:228 wide.
 *           Step 1 has only a full-width "Next ›".
 *
 * Step 3 starts at Figma's 7:00 AM – 10:00 PM. Times are typed freely — "7am",
 * "0700", "22:00" — and rewritten as "h:mm AM/PM" when the box loses focus;
 * closing at or before opening is allowed (late-night places) and noted. Each
 * field names its own problem under it once "Next" has been tried, and every
 * required field carries the asterisk. Closing the sheet with anything typed
 * asks before throwing it away.
 *
 * The Modal FADES rather than slides: react-native-web (and iOS) slide the
 * whole modal, scrim included, so mid-animation the dimming covered only part
 * of the screen and the panel hung off the bottom. Only the panel moves now, a
 * short distance, and it caps at 90% of the screen with the body scrolling
 * inside it, so the footer is always on screen — down to 320x640.
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

/** How far the panel travels as the scrim fades in. */
const SLIDE_DISTANCE = 48;

/** Figma's step 3 values (385:4500) — filled in, not placeholders. */
const DEFAULT_OPEN = '7:00 AM';
const DEFAULT_CLOSE = '10:00 PM';

type Props = {
  visible: boolean;
  supplierUid: string;
  onClose: () => void;
  /** The new restaurant's id and name, once it is saved. */
  onCreated: (merchantId: string, name: string) => void;
};

export function AddRestaurantSheet({ visible, supplierUid, onClose, onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Errors appear once a step's "Next" has been tried, not while it is blank.
  const [attempted, setAttempted] = useState<number[]>([]);

  const [name, setName] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openTime, setOpenTime] = useState(DEFAULT_OPEN);
  const [closeTime, setCloseTime] = useState(DEFAULT_CLOSE);
  const [closedDays, setClosedDays] = useState<Day[]>([]);
  const [prepIndex, setPrepIndex] = useState(-1);
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('');

  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    slide.setValue(1);
    Animated.timing(slide, {
      toValue: 0,
      duration: duration.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, slide]);

  const reset = () => {
    setStep(0);
    setError(null);
    setAttempted([]);
    setName('');
    setCuisines('');
    setTagline('');
    setAddress('');
    setPhone('');
    setOpenTime(DEFAULT_OPEN);
    setCloseTime(DEFAULT_CLOSE);
    setClosedDays([]);
    setPrepIndex(-1);
    setDeliveryAvailable(true);
    setDeliveryFee('');
  };

  const discard = () => {
    reset();
    onClose();
  };

  const dirty =
    !!(name.trim() || cuisines.trim() || tagline.trim() || address.trim() || phone.trim() || deliveryFee.trim()) ||
    openTime !== DEFAULT_OPEN ||
    closeTime !== DEFAULT_CLOSE ||
    closedDays.length > 0 ||
    prepIndex !== -1 ||
    !deliveryAvailable;

  // The scrim, ✕ and Android back all come here: nothing typed is lost unasked.
  const close = () => {
    if (busy) return;
    if (!dirty) {
      discard();
      return;
    }
    Alert.alert('Discard this restaurant?', 'What you entered in these steps will be lost.', [
      { text: 'Discard', style: 'destructive', onPress: discard },
      { text: 'Keep editing', style: 'cancel' },
    ]);
  };

  const prep = PREP_TIMES[prepIndex];
  const input: NewRestaurant = {
    name,
    // "Sri Lankan · Authentic" — the separator Figma shows in the hint.
    cuisines: cuisines.split(/[·,]/).map((c) => c.trim()).filter(Boolean),
    tagline,
    address,
    phone,
    // "7am" is saved as "7:00 AM"; anything unreadable stays as typed and fails.
    openTime: normaliseTime(openTime) ?? openTime,
    closeTime: normaliseTime(closeTime) ?? closeTime,
    closedDays,
    prepTimeMin: prep?.min ?? NaN,
    prepTimeMax: prep?.max ?? NaN,
    deliveryAvailable,
    deliveryFee: deliveryAvailable ? parseDeliveryFee(deliveryFee) : 0,
  };
  const stepErrors = restaurantStepErrors(input);
  const showErrors = attempted.includes(step);
  const invalid = invalidRestaurantFields(input);
  const flag = (field: RestaurantField) => showErrors && invalid.has(field);
  const fieldError = (field: RestaurantField) => (flag(field) ? RESTAURANT_FIELD_MESSAGES[field] : null);
  // Field problems sit under their fields; this line is for the save itself.
  const message = error;
  const timeNote = hoursNote(input.openTime, input.closeTime);

  const markAttempted = (s: number) => setAttempted((prev) => (prev.includes(s) ? prev : [...prev, s]));

  const submit = async () => {
    const invalidStep = stepErrors.findIndex(Boolean);
    if (invalidStep !== -1) {
      setStep(invalidStep);
      markAttempted(invalidStep);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createRestaurant(supplierUid, input);
      const created = input.name.trim();
      reset();
      onCreated(id, created);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('permission')
          ? 'Only a business account can add a restaurant.'
          : !isFirebaseReady()
            ? 'Could not save the demo restaurant on this device. Check browser storage and try again.'
            : 'Could not create the restaurant. Check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (busy) return;
    setError(null);
    if (stepErrors[step]) {
      markAttempted(step);
      return;
    }
    if (step === STEPS.length - 1) void submit();
    else setStep(step + 1);
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const toggleClosed = (day: Day) =>
    setClosedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const isLast = step === STEPS.length - 1;

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, SLIDE_DISTANCE] }) }] },
          ]}
        >
          <View style={styles.gripRow}>
            <View style={styles.grip} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="sectionTitle" color={colors.text} accessibilityRole="header">
                Add Restaurant
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
              </Text>
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

          <View style={styles.stepper} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((label, i) => (
              <View
                key={label}
                style={[styles.pip, i === step && styles.pipCurrent, i < step && styles.pipDone]}
              />
            ))}
          </View>

          <ScrollView
            key={step}
            style={styles.scroll}
            contentContainerStyle={[styles.body, isLast && styles.bodyLoose]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 ? (
              <>
                <SupplierField
                  label="Restaurant Name"
                  required
                  labelStyle={styles.eyebrow}
                  error={fieldError('name')}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Mama's Kitchen"
                />
                <SupplierField
                  label="Cuisine / Category"
                  required
                  labelStyle={styles.eyebrow}
                  error={fieldError('cuisines')}
                  value={cuisines}
                  onChangeText={setCuisines}
                  placeholder="e.g. Sri Lankan · Authentic"
                />
                <SupplierField
                  label="Short Description"
                  required
                  multiline
                  labelStyle={styles.eyebrow}
                  error={fieldError('tagline')}
                  style={styles.description}
                  value={tagline}
                  onChangeText={setTagline}
                  placeholder="Describe your restaurant in a few words…"
                />
              </>
            ) : step === 1 ? (
              <>
                <SupplierField
                  label="Address"
                  required
                  labelStyle={styles.eyebrow}
                  error={fieldError('address')}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. 42, Main Street, Trincomalee"
                />
                <SupplierField
                  label="Phone Number"
                  required
                  labelStyle={styles.eyebrow}
                  error={fieldError('phone')}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="e.g. +94 26 222 3456"
                />
                <View style={styles.note}>
                  <View style={styles.noteIcon}>
                    <Icon name="mapPinSm" size={16} color={colors.palette.green600} />
                  </View>
                  <Text variant="bodyRegular" color={colors.palette.green800} style={styles.noteText}>
                    Map pin can be set after creation from Restaurant Information settings.
                  </Text>
                </View>
              </>
            ) : step === 2 ? (
              <>
                <View style={styles.row}>
                  <SupplierField
                    label="Opening Time"
                    required
                    labelStyle={styles.eyebrow}
                    containerStyle={styles.rowHalf}
                    style={styles.timeInput}
                    invalid={flag('openTime')}
                    value={openTime}
                    onChangeText={setOpenTime}
                    onBlur={() => setOpenTime((t) => normaliseTime(t) ?? t)}
                    autoCorrect={false}
                    autoCapitalize="characters"
                    placeholder="7:00 AM"
                  />
                  <SupplierField
                    label="Closing Time"
                    required
                    labelStyle={styles.eyebrow}
                    containerStyle={styles.rowHalf}
                    style={styles.timeInput}
                    invalid={flag('closeTime')}
                    value={closeTime}
                    onChangeText={setCloseTime}
                    onBlur={() => setCloseTime((t) => normaliseTime(t) ?? t)}
                    autoCorrect={false}
                    autoCapitalize="characters"
                    placeholder="10:00 PM"
                  />
                </View>
                {fieldError('openTime') || fieldError('closeTime') ? (
                  <Text variant="bodySm" color={colors.primary} style={styles.rowNote} accessibilityLiveRegion="polite">
                    {[fieldError('openTime'), fieldError('closeTime')].filter(Boolean).join(' ')}
                  </Text>
                ) : timeNote ? (
                  <Text variant="microRegular" color={colors.textSecondary} style={styles.rowNote}>
                    {timeNote}
                  </Text>
                ) : null}

                <View style={styles.field}>
                  <Text variant="eyebrowSm" color={colors.textMuted} style={styles.eyebrow}>
                    Closed On (select days)
                  </Text>
                  <View style={styles.chips}>
                    {DAY_LABELS.map(({ day, label }) => {
                      const on = closedDays.includes(day);
                      return (
                        <Pressable
                          key={day}
                          accessibilityRole="button"
                          accessibilityLabel={`Closed on ${label}`}
                          accessibilityState={{ selected: on }}
                          onPress={() => toggleClosed(day)}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text variant="label" color={on ? colors.onPrimary : colors.textSecondary}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Text variant="microRegular" color={colors.textMuted}>
                  These hours apply to all other days. You can customize individual days later from
                  Restaurant Information.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.field}>
                  <Text variant="eyebrowSm" color={colors.textMuted} style={styles.eyebrow}>
                    Average Preparation Time *
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
                          style={[
                            styles.chipLg,
                            on && styles.chipOn,
                            flag('prepTime') && styles.chipInvalid,
                          ]}
                        >
                          <Text variant="labelMd" color={on ? colors.onPrimary : colors.textSecondary}>
                            {p.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {fieldError('prepTime') ? (
                    <Text variant="bodySm" color={colors.primary} accessibilityLiveRegion="polite">
                      {fieldError('prepTime')}
                    </Text>
                  ) : null}
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
                    accessibilityLabel="Delivery Available"
                    accessibilityState={{ checked: deliveryAvailable }}
                    onPress={() => setDeliveryAvailable((v) => !v)}
                    hitSlop={8}
                    style={[styles.switch, deliveryAvailable && styles.switchOn]}
                  >
                    <View style={[styles.knob, deliveryAvailable && styles.knobOn]} />
                  </Pressable>
                </View>

                {deliveryAvailable ? (
                  <SupplierField
                    label="Delivery Fee"
                    required
                    labelStyle={styles.eyebrow}
                    error={fieldError('deliveryFee')}
                    value={deliveryFee}
                    onChangeText={setDeliveryFee}
                    keyboardType="decimal-pad"
                    placeholder="Rs. 150"
                  />
                ) : null}
              </>
            )}

            {message ? (
              <Text variant="bodySm" color={colors.primary} accessibilityLiveRegion="polite">
                {message}
              </Text>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: spacing[12] + insets.bottom }]}>
            {step > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={back}
                style={({ pressed }) => [styles.cta, styles.ctaBack, pressed && styles.pressed]}
              >
                <Icon name="chevronLeft" size={16} color={colors.palette.gray700} />
                <Text variant="labelLg" color={colors.palette.gray700}>
                  Back
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy, disabled: busy }}
              disabled={busy}
              onPress={next}
              style={({ pressed }) => [
                styles.cta,
                styles.ctaNext,
                isLast && styles.ctaCreate,
                (pressed || busy) && styles.pressed,
              ]}
            >
              {isLast ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
              <Text variant="h4" color={colors.onPrimary}>
                {isLast ? (busy ? 'Creating…' : 'Create Restaurant') : 'Next'}
              </Text>
              {isLast ? null : <Icon name="chevronRight" size={16} color={colors.onPrimary} />}
            </Pressable>
          </View>
        </Animated.View>
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
    // Never taller than the screen: the body scrolls, the footer stays put.
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
  headerText: { flexShrink: 1 },
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
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: spacing[8], paddingBottom: spacing[9], gap: spacing[5] },
  bodyLoose: { gap: spacing[6] },
  eyebrow: { textTransform: 'uppercase' },
  description: { fontFamily: fontFamily[400] },
  field: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[3.5] },
  rowHalf: { flex: 1 },
  // The body's own gap already separates the note from the row.
  rowNote: { marginTop: -spacing[2.5] },
  timeInput: {
    ...typography.labelMd,
    height: 42.5,
    paddingHorizontal: spacing[4],
    paddingVertical: 11,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  chip: {
    height: 33,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 0.51,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surfaceAlt,
  },
  chipLg: {
    height: 36.5,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
    borderWidth: 0.51,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipInvalid: { borderColor: colors.primary },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3.5],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.palette.green25,
    borderWidth: 0.51,
    borderColor: colors.palette.green200,
  },
  noteIcon: { paddingTop: spacing.px },
  noteText: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radius.xl,
    borderWidth: 0.51,
    borderColor: colors.border,
  },
  toggleText: { flexShrink: 1 },
  switch: { width: 44, height: 24, borderRadius: radius.pill, backgroundColor: colors.border, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.primary },
  knob: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    marginLeft: 3,
    ...shadows.raised,
  },
  knobOn: { marginLeft: 23 },
  footer: {
    flexDirection: 'row',
    gap: spacing[3.5],
    paddingTop: spacing[3.5],
    paddingHorizontal: spacing[8],
    borderTopWidth: 0.51,
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
  // Figma's 115:228 split between Back and Next.
  ctaBack: { flex: 115, borderWidth: 0.51, borderColor: colors.border },
  ctaNext: { flex: 228, backgroundColor: colors.primary },
  ctaCreate: { gap: spacing[3] },
  pressed: { opacity: 0.6 },
});
