import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MAX_WIDTH, colors, fontFamily, radius, spacing } from '@core/theme';
import { Icon, Text } from '@core/ui';
import { Alert } from '@core/ui/alert';
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
import {
  createOffer,
  offerDraftErrors,
  updateOffer,
  type OfferDraft,
  type OfferDraftErrors,
} from '../services/offers';
import { CalendarGrid } from '../components/CalendarGrid';

/**
 * Create / edit an offer — two steps.
 *
 * Step 1 "Set Discount" — Figma 374:5362 (percentage, all items) and 374:5524
 * (fixed amount, specific items):
 *   sheet    r24 top · 36×4 #E5E7EB grip, 12 above
 *   header   pad 14/20 · title 700 17/25.5 · "Step 1 of 2" 500 11/16.5 #9CA3AF ·
 *            30pt #F3F4F6 close · dots gap 6, 8 below: current 18×6 #D42B2B,
 *            other 6×6 #E5E7EB
 *   body     pad 0/20/24 · fields 18 apart · label 700 10/15 ls0.55 #9CA3AF,
 *            8 above the control
 *   options  r12 · 0.51 border · gap 8 · on #FFF0F0/#D42B2B/#D42B2B text ·
 *            off #F9FAFB/#E5E7EB/#6B7280 — 44h 700 13 for the type, 40h 700 12
 *            for "applies to" (10 below it)
 *   items    r12 0.51 #E5E7EB list · rows pad 11/14, 0.51 #F3F4F6 rule ·
 *            name 600 13/19.5 · "Mains · Rs. 450" 400 11/16.5 #9CA3AF ·
 *            20pt r6 checkbox 0.51 #D1D5DB · ticked row #FFF8F8, red name,
 *            red box with an 11pt check
 *   amount   53h r12 · "%" / "Rs." 700 14/21 #9CA3AF at 14 · value 700 20/30 at 38
 *   inputs   42.5h r12 · 500 13/19.5 · "Rs." prefix #9CA3AF · 17.5pt calendar
 *            11 from the right
 *   summary  #F9FAFB r14 0.51 #E5E7EB pad 12/14 · "10% OFF" 800 18/27 #D42B2B,
 *            6 above · "on All items · Until 30 Sept" 400 12/18 #6B7280 ·
 *            note 400 11/16.5 #9CA3AF, 6 above
 *   next     50h r14 #D42B2B · 700 15/22.5 · 16pt chevron, gap 8
 *
 * Step 2 "Customize Look" — Figma 370:3714 / 370:4811:
 *   header   30pt back button, 10 to the title · step 2 dot current
 *   preview  the large OfferCard · Top Label input 600 13/19.5
 *   colours  4 × 2 swatches, 44h r12, gap 10 · selected drawn at 95%
 *   art      5 × 2 tiles, 68.5h r12 #F9FAFB 0.51 #E5E7EB, gap 8 · 34pt art,
 *            4 to a 500 9/13.5 #6B7280 label · selected #FFF0F0, #D42B2B
 *            border and label
 *   save     50h r14 #D42B2B · 16pt save icon · "Save Changes" 700 15/22.5
 *
 * Validation is inline: a field shows its problem as soon as it holds a bad
 * value, and pressing Next shows every remaining one and scrolls to the first.
 * The inputs carry their own border so the web focus ring follows the box.
 *
 * `offerDraftErrors` keeps a fixed amount under the minimum order (else every
 * qualifying order is free); beyond it, the editor warns — without blocking —
 * when the amount reaches the price of a selected dish, or when there is no
 * minimum at all.
 *
 * "Next" / "Save Changes" sit in a sticky footer (0.51 #F3F4F6 rule, pad
 * 10/20) so they are never half off the bottom edge. "Valid Until" blurs
 * whatever input had focus before opening the calendar, so typing can't land
 * in the previous field. Closing with changes asks first.
 */
type Props = {
  visible: boolean;
  merchantId: string;
  /** Present when editing. */
  offer?: Promotion | null;
  /** Prefills a NEW offer from this one — "Duplicate". Ignored when editing. */
  template?: Promotion | null;
  onClose: () => void;
  onSaved: (kind: 'created' | 'updated') => void;
};

const BACKGROUND_ROWS: OfferBackground[][] = [
  ['sunset', 'grape', 'ocean', 'lime'],
  ['navy', 'crimson', 'amber', 'slate'],
];

const ILLUSTRATION_KEYS = Object.keys(OFFER_ILLUSTRATIONS);
const ILLUSTRATION_ROWS = [ILLUSTRATION_KEYS.slice(0, 5), ILLUSTRATION_KEYS.slice(5, 10)];

type FieldKey = keyof OfferDraftErrors;
const FIELD_ORDER: FieldKey[] = ['value', 'itemIds', 'minOrder', 'validUntil', 'usageLimit'];

/**
 * Digits only — every number here is whole (percent, rupees, uses) — without
 * leading zeros, so "0" then "5" reads 5, not "05".
 */
const digits = (s: string) => s.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

/** The Top Label's limit, shown as a live count. */
const LABEL_MAX = 24;

/** Blur whatever input has focus — on the web the keyboard is the page's. */
function blurActiveInput() {
  Keyboard.dismiss();
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
}
const numberOrUndefined = (s: string) => (s ? Number(s) : undefined);

export function OfferEditorSheet({ visible, merchantId, offer, template, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});
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
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The form as it opened, to tell whether closing would lose anything.
  const initial = useRef('');

  // Load the form from the offer (a template, or blank) every time the sheet
  // opens. A duplicate keeps everything but the date, which is chosen again.
  useEffect(() => {
    if (!visible) return;
    const source = offer ?? template ?? null;
    const form = {
      type: source?.type ?? 'percent',
      value: source ? String(source.value) : '',
      appliesTo: source?.appliesTo ?? 'all',
      itemIds: source?.itemIds ?? [],
      minOrder: source?.minOrder ? String(source.minOrder) : '',
      validUntil: offer ? startOfDay(offer.validUntil) : null,
      usageLimit: source?.usageLimit ? String(source.usageLimit) : '',
      look: source?.look ?? DEFAULT_LOOK,
    } as const;
    initial.current = JSON.stringify(form);
    setStep(0);
    setError(null);
    setAttempted(false);
    setCalendarOpen(false);
    setMenu(null);
    setType(form.type);
    setValue(form.value);
    setAppliesTo(form.appliesTo);
    setItemIds([...form.itemIds]);
    setMinOrder(form.minOrder);
    setValidUntil(form.validUntil);
    setMonth(startOfMonth(offer?.validUntil ?? Date.now()));
    setUsageLimit(form.usageLimit);
    setLook(form.look);
  }, [visible, offer, template]);

  const dirty =
    JSON.stringify({ type, value, appliesTo, itemIds, minOrder, validUntil, usageLimit, look }) !== initial.current;

  // The scrim, ✕ and Android back all come here.
  const close = () => {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(offer ? 'Discard your changes?' : 'Discard this offer?', 'What you entered will be lost.', [
      { text: 'Discard', style: 'destructive', onPress: onClose },
      { text: 'Keep editing', style: 'cancel' },
    ]);
  };

  // The menu is read when "Specific Items" is first chosen.
  useEffect(() => {
    if (!visible || appliesTo !== 'items' || menu !== null) return;
    let live = true;
    listAllMenuItems(merchantId)
      .then((items) => live && setMenu(items))
      .catch(() => live && setMenu([]));
    return () => {
      live = false;
    };
  }, [visible, appliesTo, merchantId, menu]);

  // An offer runs to the END of its last day.
  const endsAt = validUntil !== null ? addDays(validUntil, 1) - 1 : undefined;
  const amount = value ? Number(value) : NaN;
  const draft: OfferDraft = {
    type,
    value: amount,
    appliesTo,
    itemIds: appliesTo === 'items' ? itemIds : [],
    minOrder: numberOrUndefined(minOrder),
    validUntil: endsAt ?? NaN,
    usageLimit: numberOrUndefined(usageLimit),
    look: { ...look, label: look.label.trim() },
  };
  const errors = offerDraftErrors({ ...draft, validUntil: endsAt });

  // Not an error — a dish-level discount may be meant generously — but say it.
  const selected = appliesTo === 'items' && menu ? menu.filter((i) => itemIds.includes(i.id)) : [];
  const cheapest = selected.reduce<MenuItem | null>((low, i) => (!low || i.price < low.price ? i : low), null);
  const valueWarning =
    type !== 'fixed' || errors.value || !(amount > 0)
      ? null
      : cheapest && amount >= cheapest.price
        ? `${formatMoney(amount)} off is at least the price of ${cheapest.name} (${formatMoney(cheapest.price)}) — ordered on its own, it would be free.`
        : appliesTo === 'all' && !draft.minOrder
          ? 'With no minimum order, a small order could cost nothing. Consider setting a minimum below.'
          : null;

  // A bad value shows at once; a missing one only after Next is pressed.
  const shown: Record<FieldKey, boolean> = {
    value: attempted || value !== '',
    itemIds: attempted,
    minOrder: attempted || minOrder !== '',
    validUntil: attempted || validUntil !== null,
    usageLimit: attempted || usageLimit !== '',
  };
  const errorFor = (key: FieldKey) => (shown[key] ? errors[key] : undefined);

  const summary = { ...draft, value: errors.value ? 0 : amount, validUntil: endsAt ?? 0 };

  const next = () => {
    setAttempted(true);
    const first = FIELD_ORDER.find((key) => errors[key]);
    if (first) {
      const y = fieldY.current[first];
      if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - spacing[4]), animated: true });
      return;
    }
    setStep(1);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const save = async () => {
    // Time may have moved on since step 1 — the last day can have passed.
    const live = offerDraftErrors(draft);
    if (FIELD_ORDER.some((key) => live[key])) {
      setAttempted(true);
      setStep(0);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (offer) await updateOffer(offer, draft);
      else await createOffer(merchantId, draft);
      onSaved(offer ? 'updated' : 'created');
    } catch {
      setError('Could not save the offer. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const track = (key: FieldKey) => (e: { nativeEvent: { layout: { y: number } } }) => {
    fieldY.current[key] = e.nativeEvent.layout.y;
  };

  const title = step === 0 ? 'Set Discount' : 'Customize Look';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />

        <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
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
                  hitSlop={6}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              hitSlop={6}
              style={styles.round}
            >
              <Icon name="close" size={14} color={colors.palette.gray700} />
            </Pressable>
          </View>

          <View style={styles.dots}>
            <View style={[styles.dot, step === 0 && styles.dotOn]} />
            <View style={[styles.dot, step === 1 && styles.dotOn]} />
          </View>

          <ScrollView
            ref={scroll}
            style={styles.scroll}
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

                <Field
                  label={type === 'percent' ? 'Discount Percentage' : 'Discount Amount (Rs.)'}
                  error={errorFor('value')}
                  onLayout={track('value')}
                >
                  <View>
                    <TextInput
                      style={[styles.amountInput, !!errorFor('value') && styles.invalid]}
                      value={value}
                      onChangeText={(t) => setValue(digits(t))}
                      keyboardType="number-pad"
                      accessibilityLabel={type === 'percent' ? 'Discount percentage' : 'Discount amount in rupees'}
                      placeholder={type === 'percent' ? '10' : '20'}
                      placeholderTextColor={colors.textMuted}
                      maxLength={type === 'percent' ? 3 : 6}
                    />
                    <Text style={styles.amountPrefix}>{type === 'percent' ? '%' : 'Rs.'}</Text>
                  </View>
                  {valueWarning ? (
                    <Text variant="bodySm" color={colors.palette.amber800} style={styles.fieldError}>
                      {valueWarning}
                    </Text>
                  ) : null}
                </Field>

                <Field label="Applies To" error={errorFor('itemIds')} onLayout={track('itemIds')}>
                  <View style={[styles.appliesTo, appliesTo === 'all' && styles.appliesToAll]}>
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
                      <View style={[styles.itemList, !!errorFor('itemIds') && styles.invalid]}>
                        {menu === null ? (
                          <Text variant="bodyRegular" color={colors.textMuted} style={styles.itemEmpty}>
                            Loading your menu…
                          </Text>
                        ) : menu.length === 0 ? (
                          <Text variant="bodyRegular" color={colors.textMuted} style={styles.itemEmpty}>
                            Add dishes on Menu Management first.
                          </Text>
                        ) : (
                          menu.map((item, i) => {
                            const on = itemIds.includes(item.id);
                            const off = item.available === false;
                            return (
                              <Pressable
                                key={item.id}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: on }}
                                accessibilityLabel={off ? `${item.name}, unavailable` : item.name}
                                onPress={() =>
                                  setItemIds(on ? itemIds.filter((x) => x !== item.id) : [...itemIds, item.id])
                                }
                                style={[
                                  styles.itemRow,
                                  i < menu.length - 1 && styles.itemRule,
                                  on && styles.itemRowOn,
                                ]}
                              >
                                <View style={styles.flex}>
                                  <Text
                                    variant="body"
                                    color={on ? colors.primary : colors.text}
                                    style={styles.itemName}
                                    numberOfLines={1}
                                  >
                                    {item.name}
                                  </Text>
                                  <Text variant="microRegular" color={colors.textMuted} numberOfLines={1}>
                                    {[item.category, formatMoney(item.price), off ? 'Unavailable' : null]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </Text>
                                </View>
                                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                                  {on ? <Icon name="check" size={11} color={colors.onPrimary} /> : null}
                                </View>
                              </Pressable>
                            );
                          })
                        )}
                      </View>
                    ) : null}
                  </View>
                </Field>

                <Field
                  label="Minimum Order Amount (optional)"
                  error={errorFor('minOrder')}
                  onLayout={track('minOrder')}
                >
                  <View>
                    <TextInput
                      style={[styles.input, styles.inputWithPrefix, !!errorFor('minOrder') && styles.invalid]}
                      value={minOrder}
                      onChangeText={(t) => setMinOrder(digits(t))}
                      keyboardType="number-pad"
                      accessibilityLabel="Minimum order amount in rupees"
                      maxLength={6}
                    />
                    <Text variant="body" color={colors.textMuted} style={styles.inputPrefix}>
                      Rs.
                    </Text>
                  </View>
                </Field>

                <Field label="Valid Until" error={errorFor('validUntil')} onLayout={track('validUntil')}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choose the last day the offer runs"
                    onPress={() => {
                      blurActiveInput();
                      setCalendarOpen(!calendarOpen);
                    }}
                    style={[styles.dateBox, !!errorFor('validUntil') && styles.invalid]}
                  >
                    <Text variant="body" color={validUntil !== null ? colors.text : colors.textMuted}>
                      {validUntil !== null ? isoDay(validUntil) : 'YYYY - MM - DD'}
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

                <Field label="Usage Limit (optional)" error={errorFor('usageLimit')} onLayout={track('usageLimit')}>
                  <TextInput
                    style={[styles.input, !!errorFor('usageLimit') && styles.invalid]}
                    value={usageLimit}
                    onChangeText={(t) => setUsageLimit(digits(t))}
                    keyboardType="number-pad"
                    accessibilityLabel="Usage limit, blank for no limit"
                    placeholder="10"
                    placeholderTextColor={colors.textMuted}
                    maxLength={6}
                  />
                </Field>

                <View style={styles.summary}>
                  <Text variant="eyebrowSm" color={colors.textMuted}>
                    OFFER SUMMARY
                  </Text>
                  <Text style={styles.summaryValue}>{summary.value > 0 ? discountLabel(summary) : '—'}</Text>
                  <Text variant="bodyRegular" color={colors.textSecondary}>
                    {[
                      scopeLabel(summary),
                      summary.minOrder ? `Min. ${formatMoney(summary.minOrder)}` : null,
                      validUntil !== null ? `Until ${formatDayMonth(validUntil)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text variant="microRegular" color={colors.textMuted} style={styles.summaryNote}>
                    This will be used as the card headline in the next step.
                  </Text>
                </View>

              </>
            ) : (
              <>
                <Field label="Preview">
                  <OfferCard look={look} headline={offerHeadline(summary, { withDate: false })} subtitle={summary.validUntil ? `Until ${formatDayMonth(summary.validUntil)}` : undefined} badge={discountLabel(summary)} />
                </Field>

                <Field label="Top Label" count={`${look.label.length}/${LABEL_MAX}`}>
                  <TextInput
                    style={[styles.input, styles.labelInput]}
                    value={look.label}
                    // The card sets it in capitals; so does the field, on every platform.
                    onChangeText={(label) => setLook({ ...look, label: label.toUpperCase() })}
                    autoCapitalize="characters"
                    accessibilityLabel="Top label"
                    maxLength={LABEL_MAX}
                    placeholder="LIMITED TIME OFFER"
                    placeholderTextColor={colors.textMuted}
                  />
                </Field>

                <Field label="Background Color">
                  <View style={styles.swatches}>
                    {BACKGROUND_ROWS.map((row) => (
                      <View key={row[0]} style={styles.swatchRow}>
                        {row.map((key) => {
                          const on = look.background === key;
                          return (
                            <Pressable
                              key={key}
                              accessibilityRole="radio"
                              accessibilityLabel={key}
                              accessibilityState={{ selected: on }}
                              onPress={() => setLook({ ...look, background: key })}
                              style={styles.swatchCell}
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
                    ))}
                  </View>
                </Field>

                <Field label="Illustration">
                  <View style={styles.arts}>
                    {ILLUSTRATION_ROWS.map((row) => (
                      <View key={row[0]} style={styles.artRow}>
                        {row.map((key) => {
                          const { label, Art } = OFFER_ILLUSTRATIONS[key]!;
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
                              <Text style={[styles.artLabel, on && styles.artLabelOn]} numberOfLines={1}>
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </Field>

              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step === 1 && error ? (
              <Text variant="bodySm" color={colors.primary} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {step === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next: Customize Look"
                onPress={next}
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              >
                <Text variant="h4" color={colors.onPrimary}>
                  Next: Customize Look
                </Text>
                <Icon name="chevronRight" size={16} color={colors.onPrimary} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save Changes"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void save()}
                style={({ pressed }) => [styles.primary, (busy || pressed) && styles.pressed]}
              >
                <Icon name="save" size={16} color={colors.onPrimary} />
                <Text variant="h4" color={colors.onPrimary}>
                  {busy ? 'Saving…' : 'Save Changes'}
                </Text>
              </Pressable>
            )}
          </View>
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

function Field({
  label,
  error,
  count,
  onLayout,
  children,
}: {
  label: string;
  error?: string;
  /** A live character count on the right of the label, e.g. "12/24". */
  count?: string;
  onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field} onLayout={onLayout}>
      <View style={styles.labelRow}>
        <Text variant="eyebrowSm" color={colors.textMuted}>
          {label.toUpperCase()}
        </Text>
        {count ? (
          <Text variant="captionRegular" color={colors.textMuted}>
            {count}
          </Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text variant="bodySm" color={colors.primary} style={styles.fieldError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
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
      accessibilityLabel={label}
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

const HAIRLINE = 0.51;

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
  dots: { flexDirection: 'row', gap: spacing[2.5], justifyContent: 'center', paddingBottom: spacing[3] },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  dotOn: { width: 18, backgroundColor: colors.primary },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: spacing[8], paddingBottom: spacing[9], gap: spacing[7] },
  footer: {
    gap: spacing[3],
    paddingTop: spacing[3.5],
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[8],
    borderTopWidth: HAIRLINE,
    borderTopColor: colors.surfaceAlt,
  },
  field: { gap: spacing[3] },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldError: { marginTop: -spacing[0.5] },
  flex: { flex: 1 },
  invalid: { borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  optionRow: { flexDirection: 'row', gap: spacing[3] },
  option: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSmall: { height: 40 },
  optionOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  optionOff: { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
  optionText: { fontFamily: fontFamily[700] },
  appliesTo: { gap: spacing[3.5] },
  appliesToAll: { paddingBottom: spacing[3.5] },
  // The prefixes are drawn over their input; taps fall through to it.
  amountPrefix: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 14,
    top: 16,
    fontFamily: fontFamily[700],
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  amountInput: {
    height: 53,
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    paddingLeft: 38,
    paddingRight: 14,
    paddingVertical: 0,
    fontFamily: fontFamily[700],
    fontSize: 20,
    lineHeight: 30,
    color: colors.text,
  },
  inputPrefix: { position: 'absolute', pointerEvents: 'none', left: 14, top: 11.5 },
  input: {
    minHeight: 48,
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontFamily: fontFamily[500],
    fontSize: 16,
    color: colors.text,
  },
  inputWithPrefix: { paddingLeft: 38 },
  labelInput: { fontFamily: fontFamily[600] },
  dateBox: {
    minHeight: 48,
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 11,
  },
  calendar: {
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    paddingTop: spacing[4],
  },
  itemList: {
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemEmpty: { padding: spacing[5] },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  itemRule: { borderBottomWidth: HAIRLINE, borderBottomColor: colors.surfaceAlt },
  itemRowOn: { backgroundColor: colors.primaryTint },
  itemName: { fontFamily: fontFamily[600] },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: HAIRLINE,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  summary: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: HAIRLINE,
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
  swatches: { gap: spacing[3.5] },
  swatchRow: { flexDirection: 'row', gap: spacing[3.5] },
  swatchCell: { flex: 1, height: 44 },
  swatch: { flex: 1, borderRadius: radius.xl },
  swatchOn: { transform: [{ scale: 0.95 }] },
  arts: { gap: spacing[3] },
  artRow: { flexDirection: 'row', gap: spacing[3] },
  artTile: {
    flex: 1,
    height: 68.5,
    borderRadius: radius.xl,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    paddingVertical: spacing[3],
    gap: spacing[1.5],
  },
  artTileOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  artLabel: { fontFamily: fontFamily[500], fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  artLabelOn: { color: colors.primary },
});
