import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '@core/theme';
import { Icon, Text } from '@core/ui';
import { addDays, addMonths, formatDate, formatMonth, startOfDay } from '@core/utils/datetime';

/**
 * The month grid from "Filter by Date" (Figma 346:5312), shared with the offer
 * editor's "Valid Until".
 *
 *   month    34pt #F3F4F6 chevron buttons · "August 2026" 700 15/22.5
 *   weekdays Su…Sa 500 11/16.5 #9CA3AF, 32pt rows
 *   days     7 equal columns · 40pt cells r10 · row gap 2 · 600 13/19.5 #1F2937
 *            selected #D42B2B / white · today #FFF0F0 / #D42B2B ·
 *            4pt #D42B2B dot under a marked day
 */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarGrid({
  month,
  onMonthChange,
  selected,
  onSelect,
  isDisabled,
  marked,
  minMonth,
  maxMonth,
  inset = spacing[6],
}: {
  /** Local midnight on the 1st of the month shown. */
  month: number;
  onMonthChange: (month: number) => void;
  selected: number | null;
  onSelect: (day: number | null) => void;
  isDisabled?: (day: number) => boolean;
  /** Days that get the dot. */
  marked?: Set<number>;
  minMonth?: number;
  maxMonth?: number;
  /** Horizontal padding of the grid — the sheets differ (16 vs 0). */
  inset?: number;
}) {
  const today = startOfDay(Date.now());

  const cells = useMemo(() => {
    const lead = new Date(month).getDay();
    const days: Array<number | null> = Array.from({ length: lead }, () => null);
    for (let d = month; d < addMonths(month, 1); d = addDays(d, 1)) days.push(d);
    while (days.length % 7) days.push(null);
    return days;
  }, [month]);

  const canBack = minMonth === undefined || month > minMonth;
  const canForward = maxMonth === undefined || month < maxMonth;

  return (
    <View>
      <View style={[styles.monthRow, { paddingHorizontal: inset + spacing[1.5] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canBack }}
          disabled={!canBack}
          onPress={() => onMonthChange(addMonths(month, -1))}
          style={[styles.monthButton, !canBack && styles.disabled]}
        >
          <Icon name="chevronLeft" size={16} color={colors.palette.gray700} />
        </Pressable>
        <Text variant="h4" color={colors.text}>
          {formatMonth(month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canForward }}
          disabled={!canForward}
          onPress={() => onMonthChange(addMonths(month, 1))}
          style={[styles.monthButton, !canForward && styles.disabled]}
        >
          <Icon name="chevronRight" size={16} color={colors.palette.gray700} />
        </Pressable>
      </View>

      <View style={[styles.grid, { paddingHorizontal: inset }]}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={styles.weekday}>
            <Text variant="micro" color={colors.textMuted}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.grid, styles.days, { paddingHorizontal: inset }]}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`b${i}`} style={styles.cell} />;
          const isSelected = day === selected;
          const isToday = day === today;
          const disabled = isDisabled?.(day) ?? false;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={formatDate(day)}
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(isSelected ? null : day)}
              style={[styles.cell, isSelected ? styles.cellSelected : isToday && styles.cellToday]}
            >
              <Text
                variant="body"
                style={styles.dayNumber}
                color={
                  isSelected
                    ? colors.onPrimary
                    : disabled
                      ? colors.borderStrong
                      : isToday
                        ? colors.primary
                        : colors.text
                }
              >
                {new Date(day).getDate()}
              </Text>
              {marked?.has(day) ? (
                <View style={[styles.dot, isSelected && { backgroundColor: colors.onPrimary }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[4],
  },
  monthButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  days: { rowGap: spacing[0.5], paddingBottom: spacing[3] },
  weekday: { width: `${100 / 7}%`, height: 32, alignItems: 'center', justifyContent: 'center' },
  cell: {
    width: `${100 / 7}%`,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { backgroundColor: colors.primary },
  cellToday: { backgroundColor: colors.primaryTint },
  dayNumber: { fontFamily: fontFamily[600] },
  dot: { width: 4, height: 4, marginTop: 1, borderRadius: radius.pill, backgroundColor: colors.primary },
  disabled: { opacity: 0.4 },
});
