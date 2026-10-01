import type { DayHours, Merchant } from '../types';

/**
 * Opening-hours wording for the customer side — the restaurant page's Info tab
 * ("7:00 AM – 10:00 PM, Daily") and its Closed banner ("Closed · opens 7:00 AM").
 *
 * Hours are stored per day as the design writes them ("7:00 AM"), see
 * `supplier/services/restaurantValidation.ts`. Everything here is local time.
 */

type Day = keyof Merchant['hours'];

/** `Date#getDay()` order: Sunday first. */
const DAYS: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
/** Display order: the week as the supplier edits it, Monday first. */
export const WEEK: Array<{ key: Day; label: string }> = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];
const SHORT: Record<Day, string> = {
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
};

/** "7:00 AM" → minutes after midnight, or null when unparseable. */
export function parseClock(value: string | undefined): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\s*$/i.exec(value ?? '');
  if (!m) return null;
  const hour = Number(m[1]);
  const min = Number(m[2]);
  if (hour < 1 || hour > 12 || min > 59) return null;
  return ((hour % 12) + (m[3]!.toLowerCase() === 'p' ? 12 : 0)) * 60 + min;
}

function isOpenDay(h: DayHours | undefined): h is DayHours {
  return Boolean(h && !h.closed && parseClock(h.open) != null && parseClock(h.close) != null);
}

/** "7:00 AM – 10:00 PM", or "Closed". */
export function dayHoursLabel(h: DayHours | undefined): string {
  return isOpenDay(h) ? `${h.open} – ${h.close}` : 'Closed';
}

/** True when every day has the same open hours. */
export function sameEveryDay(hours: Merchant['hours']): boolean {
  const first = hours?.mon;
  return (
    isOpenDay(first) &&
    DAYS.every((d) => isOpenDay(hours[d]) && hours[d].open === first.open && hours[d].close === first.close)
  );
}

/**
 * The Info tab's Hours line: Figma's "7:00 AM – 10:00 PM, Daily" when every
 * day matches, otherwise today's hours ("Today · 7:00 AM – 3:00 PM").
 */
export function hoursSummary(hours: Merchant['hours'] | undefined, now = new Date()): string {
  if (!hours) return 'Hours not set';
  if (sameEveryDay(hours)) return `${dayHoursLabel(hours.mon)}, Daily`;
  const today = hours[DAYS[now.getDay()]!];
  return isOpenDay(today) ? `Today · ${dayHoursLabel(today)}` : 'Closed today';
}

/**
 * When a closed restaurant next opens by its hours ("opens 7:00 AM",
 * "opens tomorrow 7:00 AM", "opens Mon 7:00 AM") — the text after "Closed ·".
 *
 * `isOpen` is the restaurant's own switch, so it can be closed inside its
 * hours; then there is no honest opening time to promise and this is null.
 */
export function nextOpeningLabel(hours: Merchant['hours'] | undefined, now = new Date()): string | null {
  if (!hours) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = hours[DAYS[now.getDay()]!];
  if (isOpenDay(today)) {
    const open = parseClock(today.open)!;
    const close = parseClock(today.close)!;
    if (minutes < open) return `opens ${today.open}`;
    const overnight = close <= open;
    if (minutes < close || overnight) return null;
  }
  for (let i = 1; i <= 7; i++) {
    const key = DAYS[(now.getDay() + i) % 7]!;
    const day = hours[key];
    if (isOpenDay(day)) return `opens ${i === 1 ? 'tomorrow' : SHORT[key]} ${day.open}`;
  }
  return null;
}

/** "Closed · opens 7:00 AM", or "Closed right now" when no time can be promised. */
export function closedLabel(hours: Merchant['hours'] | undefined, now = new Date()): string {
  const next = nextOpeningLabel(hours, now);
  return next ? `Closed · ${next}` : 'Closed right now';
}

/** Today's key, for highlighting the current day in the week list. */
export function todayKey(now = new Date()): Day {
  return DAYS[now.getDay()]!;
}
