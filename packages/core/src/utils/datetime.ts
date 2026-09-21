/**
 * Date and time formatting in the design's voice — "8:02 PM", "8:15 – 8:30 PM",
 * "30 Aug", "21 Aug 2026", "August 2026" — plus the local-day arithmetic the
 * history filters need. All times are the device's local time.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "8:02 PM". Empty for a missing or unparseable time. */
export function formatClock(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '';
  // Hermes/ICU put a narrow no-break space (U+202F) before AM/PM; normalise it
  // so the design's plain space renders and the meridiem can be stripped.
  return new Date(ms)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s+/g, ' '); // JS \s includes the U+202F Hermes puts before AM/PM
}

/** "8:15 – 8:30 PM" — the meridiem is shown once when both ends share it. */
export function formatClockWindow(from: number, to: number): string {
  const sameHalf = new Date(from).getHours() < 12 === new Date(to).getHours() < 12;
  const start = sameHalf ? formatClock(from).replace(/ [AP]M$/, '') : formatClock(from);
  return `${start} – ${formatClock(to)}`;
}

/** Local midnight at the start of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `n` days after the day containing `ms` (DST-safe). */
export function addDays(ms: number, n: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Monday 00:00 of the week containing `ms`. */
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d.getTime();
}

/** The 1st of the month containing `ms`, 00:00. */
export function startOfMonth(ms: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(1);
  return d.getTime();
}

/** The 1st of the month `n` months after the one containing `ms`. */
export function addMonths(ms: number, n: number): number {
  const d = new Date(startOfMonth(ms));
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

/** "Today", "Yesterday", or "30 Aug" — the Order History day headers. */
export function formatDayLabel(ms: number, now = Date.now()): string {
  const day = startOfDay(ms);
  if (day === startOfDay(now)) return 'Today';
  if (day === addDays(now, -1)) return 'Yesterday';
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "30 Sept" — the offer cards' "Until …" (Figma writes Sept, not Sep). */
export function formatDayMonth(ms: number): string {
  const d = new Date(ms);
  const m = MONTHS_SHORT[d.getMonth()];
  return `${d.getDate()} ${m === 'Sep' ? 'Sept' : m}`;
}

/** "21 Aug 2026". */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "August 2026". */
export function formatMonth(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export { DAY_MS };
