import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from '@core/ui';
import { Sheet } from '@core/ui/Sheet';
import { colors, radius, spacing } from '@core/theme';
import { addDays, formatClock, formatDayMonth, startOfDay } from '@core/utils/datetime';
import { deliveryWindow } from '../services/orders';
import type { DayHours, Merchant } from '../types';

type HoursMerchant = Pick<Merchant, 'hours' | 'prepTimeMin' | 'prepTimeMax'>;

const SLOT_MIN = 30;
const MINUTE = 60_000;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
/** Used when a restaurant's hours cannot be read — a normal trading day. */
const FALLBACK_HOURS = { open: 8 * 60, close: 22 * 60 };

/**
 * Minutes after midnight for the ways opening hours get written — "7:00 AM",
 * "10 PM", "07:00", "19:30", "7.30pm". Null when it is none of them.
 */
export function parseClock(raw: string | undefined): number | null {
  const m = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(raw ?? '');
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const meridiem = m[3]?.toLowerCase();
  if (min > 59 || h > 24 || (meridiem && (h < 1 || h > 12))) return null;
  if (meridiem === 'p' && h !== 12) h += 12;
  if (meridiem === 'a' && h === 12) h = 0;
  return h * 60 + min;
}

/** Opening and closing minutes for the day containing `dayMs`, or null when closed. */
function hoursOn(merchant: HoursMerchant, dayMs: number): { open: number; close: number } | null {
  const day: DayHours | undefined = merchant.hours?.[DAY_KEYS[new Date(dayMs).getDay()]!];
  if (day?.closed) return null;
  const open = parseClock(day?.open);
  let close = parseClock(day?.close);
  if (open == null || close == null) return FALLBACK_HOURS;
  // "6:00 PM – 1:00 AM": closing after midnight belongs to this day's trading.
  if (close <= open) close += 24 * 60;
  return { open, close };
}

export type ScheduleDay = { dayMs: number; title: 'Today' | 'Tomorrow'; slots: number[] };

/**
 * Delivery times on offer today and tomorrow, every 30 minutes. A slot must be
 * far enough ahead for a standard delivery to make it, no earlier than the
 * kitchen can have cooked after opening, and no later than closing.
 */
export function scheduleDays(merchant: HoursMerchant, now = Date.now()): ScheduleDay[] {
  const earliest = now + deliveryWindow(merchant, 'standard').max * MINUTE;
  return (['Today', 'Tomorrow'] as const).map((title, i) => {
    const dayMs = addDays(now, i);
    const hours = hoursOn(merchant, dayMs);
    const slots: number[] = [];
    if (hours) {
      const first = Math.max(dayMs + (hours.open + merchant.prepTimeMax) * MINUTE, earliest);
      // Snap up to the next :00 / :30 of this day.
      const step = SLOT_MIN * MINUTE;
      let t = dayMs + Math.ceil((first - dayMs) / step) * step;
      for (; t <= dayMs + hours.close * MINUTE; t += step) slots.push(t);
    }
    return { dayMs, title, slots };
  });
}

function dayWord(ms: number, now: number): string {
  const day = startOfDay(ms);
  return day === startOfDay(now) ? 'Today' : day === addDays(now, 1) ? 'Tomorrow' : formatDayMonth(ms);
}

/** "Today, 7:30 PM" / "Tomorrow, 12:00 PM" / "2 Oct, 9:00 AM". */
export function formatScheduled(ms: number, now = Date.now()): string {
  return `${dayWord(ms, now)}, ${formatClock(ms)}`;
}

/** "Deliver today at 7:30 PM" — the sheet's confirm button. */
function deliverLabel(ms: number, now: number): string {
  const word = dayWord(ms, now);
  const when = word === 'Today' || word === 'Tomorrow' ? word.toLowerCase() : `on ${word}`;
  return `Deliver ${when} at ${formatClock(ms)}`;
}

/**
 * "Schedule" on Checkout (414:3339) — the design has the tile but no picker.
 * Built from the checkout's own pieces: the "Pay with" sheet shell, the
 * delivery-mode tiles' 1.5pt outline (#FFF1F1 / #D42B2B when chosen) and the
 * address-label pills for the day switch.
 */
export function ScheduleSheet({
  visible,
  merchant,
  value,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  merchant: HoursMerchant & Pick<Merchant, 'name'>;
  value?: number;
  onConfirm: (scheduledFor: number) => void;
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState<number | null>(value ?? null);
  const [dayIndex, setDayIndex] = useState(0);

  const days = useMemo(() => scheduleDays(merchant, now), [merchant, now]);

  // Every opening starts from what is confirmed now, never a half-made choice.
  useEffect(() => {
    if (!visible) return;
    const at = Date.now();
    setNow(at);
    const fresh = scheduleDays(merchant, at);
    const still = value != null && fresh.some((d) => d.slots.includes(value)) ? value : null;
    setPending(still);
    const chosenDay = still != null ? fresh.findIndex((d) => d.slots.includes(still)) : -1;
    setDayIndex(chosenDay >= 0 ? chosenDay : Math.max(0, fresh.findIndex((d) => d.slots.length > 0)));
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const day = days[dayIndex] ?? days[0]!;
  const rows: number[][] = [];
  for (let i = 0; i < day.slots.length; i += 3) rows.push(day.slots.slice(i, i + 3));

  return (
    <Sheet visible={visible} onClose={onClose} title="Schedule delivery">
      <View style={styles.body}>
        <Text variant="bodyRegular" color={colors.textSecondary}>
          Choose when {merchant.name} should deliver your order.
        </Text>

        <View style={styles.days}>
          {days.map((d, i) => {
            const selected = i === dayIndex;
            return (
              <Pressable
                key={d.title}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setDayIndex(i)}
                style={[styles.day, selected ? styles.daySelected : styles.dayIdle]}
              >
                <Text variant="labelMd" color={selected ? colors.primary : colors.palette.gray700}>
                  {d.title}
                </Text>
                <Text variant="caption" color={selected ? colors.primary : colors.textMuted}>
                  {formatDayMonth(d.dayMs)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {rows.length ? (
          <ScrollView
            style={styles.slots}
            contentContainerStyle={styles.slotsContent}
            // A web scrollbar would eat into the third column.
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row) => (
              <View key={row[0]} style={styles.slotRow}>
                {[0, 1, 2].map((col) => {
                  const slot = row[col];
                  if (slot == null) return <View key={col} style={styles.slotSpacer} />;
                  const selected = slot === pending;
                  return (
                    <Pressable
                      key={slot}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setPending(slot)}
                      style={[styles.slot, selected ? styles.slotSelected : styles.slotIdle]}
                    >
                      <Text variant="label" color={selected ? colors.primary : colors.textStrong} numberOfLines={1}>
                        {formatClock(slot)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text variant="body" color={colors.textSecondary} align="center" style={styles.empty}>
            {day.title === 'Today'
              ? 'No delivery times left today. Try tomorrow.'
              : `${merchant.name} is closed tomorrow.`}
          </Text>
        )}

        <Button
          label={pending != null ? deliverLabel(pending, now) : 'Choose a time'}
          disabled={pending == null}
          onPress={() => {
            if (pending == null) return;
            onConfirm(pending);
            onClose();
          }}
          style={styles.confirm}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing[8], paddingTop: spacing[6] },
  days: { flexDirection: 'row', gap: spacing[3], paddingTop: spacing[6] },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 1.53,
  },
  daySelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  dayIdle: { backgroundColor: colors.surface, borderColor: colors.border },

  slots: { maxHeight: 232, marginTop: spacing[6] },
  slotsContent: { gap: spacing[3] },
  slotRow: { flexDirection: 'row', gap: spacing[3] },
  slot: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3.5],
    borderRadius: radius.xl,
    borderWidth: 1.53,
  },
  slotSpacer: { flex: 1 },
  slotSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  slotIdle: { backgroundColor: colors.surface, borderColor: colors.border },

  empty: { paddingVertical: spacing[12] },
  confirm: { marginTop: spacing[8] },
});
