import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '@core/theme';
import { Icon, Text } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import { addDays, formatDayMonth, startOfDay, startOfMonth } from '@core/utils/datetime';
import type { MenuItem, OfferLook, Promotion } from '@modules/food/types';
import {
  DEFAULT_LOOK,
  OFFER_BACKGROUNDS,
  OFFER_ILLUSTRATIONS,
  OfferCard,
  type OfferBackground,
} from '@modules/food/components/OfferCard';
import { discountLabel, offerHeadline, scopeLabel } from '@modules/food/services/promotions';
import { listAllMenuItems } from '../services/menu';
import { createOffer, updateOffer, type OfferDraft } from '../services/offers';
import { CalendarGrid } from '../components/CalendarGrid';

/**
 * Create / edit an offer — two steps.
 *
 * Step 1 "Set Discount" — Figma 374:5362 (percentage, all items) and 374:5524
 * (fixed amount, specific items):
 *   header   pad 14/20 · title 700 17/25.5 · "Step 1 of 2" 500 11/16.5 #9CA3AF ·
 *            30pt #F3F4F6 close · pips: current 18×6 #D42B2B, other 6×6 #E5E7EB
 *   labels   700 10/15 ls0.55 #9CA3AF, 8 above the control · fields 18 apart
 *   options  r12 · 0.5pt border · on #FFF0F0/#D42B2B 700 · off #F9FAFB/#E5E7EB,
 *            #6B7280 — 44h for the type, 40h for "applies to"
 *   amount   53h r12, "%" / "Rs." prefix 700 14 #9CA3AF, value 700 20/30
 *   inputs   42.5h r12 · 500 13/19.5 · "Rs." prefix · calendar at right
 *   summary  #F9FAFB r14 pad 12/14 · "10% OFF" 800 18/27 #D42B2B ·
 *            "on All items · Until 30 Sept" 400 12/18 #6B7280
 *   next     50h r14 #D42B2B · 700 15/22.5 · chevron
 *
 * Step 2 "Customize Look" — Figma 370:3714 / 370:4811:
 *   preview  the large OfferCard · Top Label input 600 13
 *   colours  4 × 2 swatches, 44h r12, gap 10 · selected: ringed
 *   art      5 × 2 tiles, 68.5h r12 #F9FAFB, 34pt art, 500 9/13.5 label ·
 *            selected #FFF0F0 with a #D42B2B border and label
 *   save     50h r14 #D42B2B · floppy icon · "Save Changes"
 */
type Props = {
  visible: boolean;
  merchantId: string;
  /** Present when editing. */
  offer?: Promotion | null;
  onClose: () => void;
  onSaved: () => void;
};

const BACKGROUND_ORDER: OfferBackground[] = [
  'sunset',
  'grape',
  'ocean',
  'lime',
  'navy',
  'crimson',
  'amber',
  'slate',
];

export function OfferEditorSheet({ visible, merchantId, offer, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<0 | 1>(0);

  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [appliesTo, setAppliesTo] = useState<'all' | 'items'>('all');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [minOrder, setMinOrder] = useState('');
  const [validUntil, setValidUntil] = useState<number | null>(null);
  const [usageLimit, setUsageLimit] = useState('');
  const [look, setLook] = useState<OfferLook>(DEFAULT_LOOK);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the form from the offer (or blank) every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setError(null);
    setCalendarOpen(false);
    setType(offer?.type ?? 'percent');
    setValue(offer ? String(offer.value) : '');
    setAppliesTo(offer?.appliesTo ?? 'all');
    setItemIds(offer?.itemIds ?? []);
    setMinOrder(offer?.minOrder ? String(offer.minOrder) : '');
    setValidUntil(offer ? startOfDay(offer.validUntil) : null);
    setMonth(startOfMonth(offer?.validUntil ?? Date.now()));
    setUsageLimit(offer?.usageLimit ? String(offer.usageLimit) : '');
    setLook(offer?.look ?? DEFAULT_LOOK);
  }, [visible, offer]);

  useEffect(() => {
    if (!visible || appliesTo !== 'items' || menu.length) return;
    listAllMenuItems(merchantId).then(setMenu).catch(() => setMenu([]));
  }, [visible, appliesTo, merchantId, menu.length]);

  const amount = Number(value.replace(/[^\d.]/g, '')) || 0;
  // An offer runs to the END of its last day.
  const endsAt = validUntil !== null ? addDays(validUntil, 1) - 1 : 0;
  const summaryPromo = {
    type,
    value: amount,
    appliesTo,
    minOrder: Number(minOrder) || undefined,
    validUntil: endsAt,
  };

  const step1Error = useMemo(() => {
    if (amount <= 0) return type === 'percent' ? 'Enter the discount percentage.' : 'Enter the discount amount.';
    if (type === 'percent' && amount > 100) return 'A percentage discount can be at most 100%.';
    if (appliesTo === 'items' && !itemIds.length) return 'Pick at least one item.';
    if (validUntil === null) return 'Choose the last day the offer runs.';
    return null;
  }, [amount, type, appliesTo, itemIds.length, validUntil]);

  const save = async () => {
    if (step1Error) return;
    setBusy(true);
    setError(null);
    const draft: OfferDraft = {
      type,
      value: amount,
      appliesTo,
      itemIds: appliesTo === 'items' ? itemIds : [],
      minOrder: Number(minOrder) || undefined,
      validUntil: endsAt,
      usageLimit: Number(usageLimit) || undefined,
      look: { ...look, label: look.label.trim() },
    };
    try {
      if (offer) await updateOffer(offer, draft);
      else await createOffer(merchantId, draft);
      onSaved();
    } catch {
      setError('Could not save the offer. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = step === 0 ? 'Set Discount' : 'Customize Look';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.panel, { paddingBottom: spacing[6] + insets.bottom }]}>
          <View style={styles.gripRow}>
            <View style={styles.grip} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {step === 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to Set Discount"
                  onPress={() => setStep(0)}
                  style={styles.round}
                >
                  <Icon name="chevronLeft" size={14} color={colors.palette.gray700} />
                </Pressable>
              ) : null}
              <View>
                <Text variant="h2" color={colors.text} style={styles.title}>
                  {title}
                </Text>
                <Text variant="micro" color={colors.textMuted}>
                  {`Step ${step + 1} of 2`}
                </Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.round}>
              <Icon name="close" size={14} color={colors.palette.gray700} />
            </Pressable>
          </View>

          <View style={styles.pips}>
            <View style={[styles.pip, step === 0 && styles.pipOn]} />
            <View style={[styles.pip, step === 1 && styles.pipOn]} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 ? (
              <>
                <Field label="Discount Type">
                  <View style={styles.optionRow}>
                    <Option label="% Percentage" on={type === 'percent'} onPress={() => setType('percent')} />
                    <Option label="Rs. Fixed Amount" on={type === 'fixed'} onPress={() => setType('fixed')} />
                  </View>
                </Field>

                <Field label={type === 'percent' ? 'Discount Percentage' : 'Discount Amount (Rs.)'}>
                  <View style={styles.amountBox}>
                    <Text style={styles.amountPrefix}>{type === 'percent' ? '%' : 'Rs.'}</Text>
                    <TextInput
                      style={[styles.amountInput, type === 'fixed' && styles.amountInputWide]}
                      value={value}
                      onChangeText={setValue}
                      keyboardType="number-pad"
                      placeholder={type === 'percent' ? '10' : '100'}
                      placeholderTextColor={colors.textMuted}
                      maxLength={type === 'percent' ? 3 : 6}
                    />
                  </View>
                </Field>

                <Field label="Applies To">
                  <View style={styles.optionRow}>
                    <Option small label="All Items" on={appliesTo === 'all'} onPress={() => setAppliesTo('all')} />
                    <Option
                      small
                      label="Specific Items"
                      on={appliesTo === 'items'}
                      onPress={() => setAppliesTo('items')}
                    />
                  </View>
                  {appliesTo === 'items' ? (
                    <View style={styles.itemList}>
                      {menu.length === 0 ? (
                        <Text variant="bodyRegular" color={colors.textMuted} style={styles.itemEmpty}>
                          Add dishes on Menu Management first.
                        </Text>
                      ) : (
                        menu.map((item, i) => {
                          const on = itemIds.includes(item.id);
                          return (
                            <Pressable
                              key={item.id}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: on }}
                              onPress={() =>
                                setItemIds(on ? itemIds.filter((x) => x !== item.id) : [...itemIds, item.id])
                              }
                              style={[styles.itemRow, i > 0 && styles.itemRule, on && styles.itemRowOn]}
                            >
                              <View style={styles.flex}>
                                <Text variant="label" color={on ? colors.primary : colors.text} numberOfLines={1}>
                                  {item.name}
                                </Text>
                                <Text variant="microRegular" color={colors.textMuted}>
                                  {[item.category, formatMoney(item.price)].filter(Boolean).join(' · ')}
                                </Text>
                              </View>
                              <View style={[styles.checkbox, on && styles.checkboxOn]}>
                                {on ? <Icon name="check" size={12} color={colors.onPrimary} /> : null}
                              </View>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </Field>

                <Field label="Minimum Order Amount (optional)">
                  <View style={styles.inputBox}>
                    <Text variant="body" color={colors.textMuted} style={styles.inputPrefix}>
                      Rs.
                    </Text>
                    <TextInput
                      style={[styles.input, styles.inputWithPrefix]}
                      value={minOrder}
                      onChangeText={setMinOrder}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </Field>

                <Field label="Valid Until">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choose the last day"
                    onPress={() => setCalendarOpen(!calendarOpen)}
                    style={[styles.inputBox, styles.dateBox]}
                  >
                    <Text variant="body" color={validUntil !== null ? colors.text : colors.textMuted}>
                      {validUntil !== null ? isoDay(validUntil) : 'Pick a date'}
                    </Text>
                    <Icon name="calendar" size={17.5} color={colors.palette.gray700} />
                  </Pressable>
                  {calendarOpen ? (
                    <View style={styles.calendar}>
                      <CalendarGrid
                        month={month}
                        onMonthChange={setMonth}
                        selected={validUntil}
                        onSelect={(d) => {
                          setValidUntil(d);
                          if (d !== null) setCalendarOpen(false);
                        }}
                        isDisabled={(d) => d < startOfDay(Date.now())}
                        minMonth={startOfMonth(Date.now())}
                        inset={spacing[1.5]}
                      />
                    </View>
                  ) : null}
                </Field>

                <Field label="Usage Limit (optional)">
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      value={usageLimit}
                      onChangeText={setUsageLimit}
                      keyboardType="number-pad"
                      placeholder="No limit"
                      placeholderTextColor={colors.textMuted}
                      maxLength={6}
                    />
                  </View>
                </Field>

                <View style={styles.summary}>
                  <Text variant="eyebrowSm" color={colors.textMuted}>
                    OFFER SUMMARY
                  </Text>
                  <Text style={styles.summaryValue}>{amount > 0 ? discountLabel(summaryPromo) : '—'}</Text>
                  <Text variant="bodyRegular" color={colors.textSecondary}>
                    {[
                      scopeLabel(summaryPromo),
                      summaryPromo.minOrder ? `Min. ${formatMoney(summaryPromo.minOrder)}` : null,
                      validUntil !== null ? `Until ${formatDayMonth(validUntil)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text variant="microRegular" color={colors.textMuted} style={styles.summaryNote}>
                    This will be used as the card headline in the next step.
                  </Text>
                </View>

                {step1Error && (amount > 0 || validUntil !== null) ? (
                  <Text variant="bodySm" color={colors.primary}>
                    {step1Error}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!step1Error }}
                  disabled={!!step1Error}
                  onPress={() => setStep(1)}
                  style={[styles.primary, !!step1Error && styles.disabled]}
                >
                  <Text variant="h4" color={colors.onPrimary}>
                    Next: Customize Look
                  </Text>
                  <Icon name="chevronRight" size={16} color={colors.onPrimary} />
                </Pressable>
              </>
            ) : (
              <>
                <Field label="Preview">
                  <OfferCard look={look} headline={offerHeadline(summaryPromo)} badge={discountLabel(summaryPromo)} />
                </Field>

                <Field label="Top Label">
                  <View style={styles.inputBox}>
                    <TextInput
                      style={[styles.input, styles.labelInput]}
                      value={look.label}
                      onChangeText={(label) => setLook({ ...look, label })}
                      autoCapitalize="characters"
                      maxLength={24}
                      placeholder="LIMITED TIME OFFER"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </Field>

                <Field label="Background Color">
                  <View style={styles.swatches}>
                    {BACKGROUND_ORDER.map((key) => {
                      const on = look.background === key;
                      return (
                        <Pressable
                          key={key}
                          accessibilityRole="radio"
                          accessibilityLabel={key}
                          accessibilityState={{ selected: on }}
                          onPress={() => setLook({ ...look, background: key })}
                          style={[styles.swatchCell, on && styles.swatchRing]}
                        >
                          <LinearGradient
                            colors={OFFER_BACKGROUNDS[key]}
                            start={{ x: 0.26, y: 0.06 }}
                            end={{ x: 0.74, y: 0.94 }}
                            style={[styles.swatch, on && styles.swatchOn]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                <Field label="Illustration">
                  <View style={styles.arts}>
                    {Object.entries(OFFER_ILLUSTRATIONS).map(([key, { label, Art }]) => {
                      const on = look.illustration === key;
                      return (
                        <Pressable
                          key={key}
                          accessibilityRole="radio"
                          accessibilityLabel={label}
                          accessibilityState={{ selected: on }}
                          onPress={() => setLook({ ...look, illustration: key })}
                          style={[styles.artTile, on && styles.artTileOn]}
                        >
                          <Art width={34} height={34} />
                          <Text style={[styles.artLabel, on && { color: colors.primary }]} numberOfLines={1}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                {error ? (
                  <Text variant="bodySm" color={colors.primary}>
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => void save()}
                  style={[styles.primary, busy && styles.disabled]}
                >
                  <Icon name="save" size={16} color={colors.onPrimary} />
                  <Text variant="h4" color={colors.onPrimary}>
                    {busy ? 'Saving…' : 'Save Changes'}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** "2026 - 09 - 30", as the design writes the date field. */
function isoDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()} - ${pad(d.getMonth() + 1)} - ${pad(d.getDate())}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="eyebrowSm" color={colors.textMuted}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Option({
  label,
  on,
  onPress,
  small,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.option, small && styles.optionSmall, on ? styles.optionOn : styles.optionOff]}
    >
      <Text
        variant={small ? 'label' : 'body'}
        style={styles.optionText}
        color={on ? colors.primary : colors.textSecondary}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['5xl'],
    borderTopRightRadius: radius['5xl'],
    maxHeight: '92%',
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3.5] },
  title: { fontSize: 17, lineHeight: 25.5 },
  round: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pips: { flexDirection: 'row', gap: spacing[2.5], justifyContent: 'center', paddingBottom: spacing[3] },
  pip: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  pipOn: { width: 18, backgroundColor: colors.primary },
  body: { paddingHorizontal: spacing[8], paddingBottom: spacing[9], gap: spacing[7] },
  field: { gap: spacing[3] },
  flex: { flex: 1 },
  optionRow: { flexDirection: 'row', gap: spacing[3] },
  option: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSmall: { height: 40 },
  optionOn: { backgroundColor: colors.palette.red25, borderColor: colors.primary },
  optionOff: { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
  optionText: { fontFamily: fontFamily[700] },
  amountBox: {
    height: 53,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  amountPrefix: {
    position: 'absolute',
    left: 14,
    fontFamily: fontFamily[700],
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  amountInput: {
    paddingLeft: 38,
    paddingRight: 14,
    fontFamily: fontFamily[700],
    fontSize: 20,
    color: colors.text,
  },
  amountInputWide: { paddingLeft: 44 },
  inputBox: {
    height: 42.5,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  inputPrefix: { position: 'absolute', left: 14 },
  input: {
    paddingHorizontal: 14,
    fontFamily: fontFamily[500],
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  inputWithPrefix: { paddingLeft: 40 },
  labelInput: { fontFamily: fontFamily[600] },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 11,
  },
  calendar: {
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingTop: spacing[4],
  },
  itemList: {
    marginTop: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemEmpty: { padding: spacing[5] },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: 14,
  },
  itemRule: { borderTopWidth: 0.5, borderTopColor: colors.border },
  itemRowOn: { backgroundColor: colors.palette.red25 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  summary: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[4],
    paddingHorizontal: 14,
  },
  summaryValue: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    lineHeight: 27,
    color: colors.primary,
    paddingTop: spacing[2.5],
  },
  summaryNote: { paddingTop: spacing[2.5] },
  primary: {
    height: 50,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  disabled: { opacity: 0.45 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3.5] },
  swatchCell: { width: '22.6%', height: 44, borderRadius: radius.xl, padding: 0 },
  swatchRing: { boxShadow: `0px 0px 0px 2px ${colors.surface}, 0px 0px 0px 4px ${colors.text}` },
  swatch: { flex: 1, borderRadius: radius.xl },
  swatchOn: { transform: [{ scale: 0.95 }] },
  arts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  artTile: {
    width: '18.2%',
    height: 68.5,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    paddingVertical: spacing[3],
    gap: spacing[1.5],
  },
  artTileOn: { backgroundColor: colors.palette.red25, borderColor: colors.primary },
  artLabel: { fontFamily: fontFamily[500], fontSize: 9, lineHeight: 13.5, color: colors.textSecondary },
});
