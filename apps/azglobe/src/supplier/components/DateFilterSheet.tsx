import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Icon, Sheet, Text } from '@core/ui';
import { addMonths, formatDate, startOfDay, startOfMonth } from '@core/utils/datetime';
import { CalendarGrid } from './CalendarGrid';

/**
 * "Filter by Date" — Figma 346:5312, opened from the Date chip on Order History.
 *
 *   header   pad 14/20 · "Filter by Date" Urbanist 700 17/25.5 #1F2937 ·
 *            30pt #F3F4F6 close button, 14pt glyph
 *   month    34pt #F3F4F6 chevron buttons · "August 2026" 700 15/22.5
 *   weekdays Su…Sa 500 11/16.5 #9CA3AF, 32pt rows
 *   days     7 equal columns · 40pt cells r10 · row gap 2 · 600 13/19.5 #1F2937
 *            selected #D42B2B / white · today #FFF0F0 / #D42B2B ·
 *            4pt #D42B2B dot under a day that has orders
 *   legend   6pt dot · "Days with orders" 400 11/16.5 #6B7280
 *   actions  Clear (0.5pt #E5E7EB, r12, 46h) · primary "Show orders for …"
 *
 * Days after today are shown but can't be picked — there can be no orders yet.
 */
export type DateFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The chosen day (local midnight), or null for no date filter. */
  value: number | null;
  onApply: (day: number | null) => void;
  /** Local-midnight timestamps of the days in [from, to) that have orders. */
  loadOrderDays: (from: number, to: number) => Promise<Set<number>>;
};

export function DateFilterSheet({ visible, onClose, value, onApply, loadOrderDays }: DateFilterSheetProps) {
  const today = startOfDay(Date.now());
  const [month, setMonth] = useState(() => startOfMonth(value ?? today));
  const [picked, setPicked] = useState<number | null>(value);
  const [orderDays, setOrderDays] = useState<Set<number>>(new Set());

  // Re-sync each time the sheet opens, so a cancelled browse doesn't stick.
  useEffect(() => {
    if (!visible) return;
    setPicked(value);
    setMonth(startOfMonth(value ?? today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    loadOrderDays(month, addMonths(month, 1))
      .then((days) => live && setOrderDays(days))
      .catch(() => live && setOrderDays(new Set()));
    return () => {
      live = false;
    };
  }, [visible, month, loadOrderDays]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text variant="h2" color={colors.text} style={styles.title}>
          Filter by Date
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
          <Icon name="close" size={14} color={colors.palette.gray700} />
        </Pressable>
      </View>

      <CalendarGrid
        month={month}
        onMonthChange={setMonth}
        selected={picked}
        onSelect={setPicked}
        isDisabled={(day) => day > today}
        marked={orderDays}
        maxMonth={startOfMonth(today)}
      />

      <View style={styles.legend}>
        <View style={styles.legendDot} />
        <Text variant="microRegular" color={colors.textSecondary}>
          Days with orders
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPicked(null);
            onApply(null);
          }}
          style={styles.clear}
        >
          <Text variant="labelLg" color={colors.palette.gray700}>
            Clear
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: picked === null }}
          disabled={picked === null}
          onPress={() => onApply(picked)}
          style={[styles.apply, picked === null && styles.disabled]}
        >
          <Text variant="h5" color={colors.onPrimary} numberOfLines={1}>
            {picked === null ? 'Pick a day' : `Show orders for ${formatDate(picked)}`}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[5],
  },
  title: { fontSize: 17, lineHeight: 25.5 },
  close: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[3.5],
  },
  legendDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', gap: spacing[3.5], paddingHorizontal: spacing[6], paddingTop: spacing[1.5] },
  clear: {
    flex: 118,
    height: 46,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apply: {
    flex: 234,
    height: 46,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  disabled: { opacity: 0.4 },
});
