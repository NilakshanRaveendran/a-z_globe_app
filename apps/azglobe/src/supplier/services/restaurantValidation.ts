import type { DayHours } from '@modules/food/types';
import type { NewRestaurant } from './restaurants';

/**
 * The rules a restaurant must pass before it is written — shared by Add
 * Restaurant (per step), Restaurant Information (on save) and
 * `createRestaurant` itself, so the three can never disagree.
 *
 * Type-only imports here: tools/restaurants.test.mjs loads this file on its
 * own, with the types stripped.
 */

/** "7:00 AM", "10:30 pm" — the h:mm AM/PM the design writes hours in. */
export function isValidTime(value: string | undefined): boolean {
  return /^(?:0?[1-9]|1[0-2]):[0-5]\d\s*(?:AM|PM)$/i.test((value ?? '').trim());
}

/**
 * A time as people type it, in the form the design writes it: "7am", "7 AM",
 * "7:30pm", "7.30 p.m.", "0700", "700", "19:30" and "22:00" all become
 * "h:mm AM/PM". Null when it is not a time at all ("25:00", "7:75", "abc").
 *
 * Without AM/PM the number is read as a 24-hour clock, so "7" is 7:00 AM and
 * "19" is 7:00 PM.
 */
export function normaliseTime(value: string | undefined): string | null {
  const text = (value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/([ap])\.?m?\.?$/, '$1m');
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm)?$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (minute > 59) return null;
  let hour24: number;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour24 = (hour % 12) + (match[3] === 'pm' ? 12 : 0);
  } else {
    if (hour > 23) return null;
    hour24 = hour;
  }
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

/** Minutes after midnight for any time `normaliseTime` accepts, else NaN. */
export function timeToMinutes(value: string | undefined): number {
  const time = normaliseTime(value);
  if (!time) return NaN;
  const [, h, m, suffix] = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time)!;
  return ((Number(h) % 12) + (suffix === 'PM' ? 12 : 0)) * 60 + Number(m);
}

/**
 * A note for hours that are valid but unusual — closing at or before opening.
 * Not an error: a bar open 6:00 PM – 2:00 AM closes the next day, and the same
 * time twice means open all day. Null for ordinary hours or unreadable times.
 */
export function hoursNote(open: string | undefined, close: string | undefined): string | null {
  const from = timeToMinutes(open);
  const to = timeToMinutes(close);
  if (Number.isNaN(from) || Number.isNaN(to) || to > from) return null;
  if (to === from) return 'Opens and closes at the same time — open 24 hours.';
  return `Closes at ${normaliseTime(close)} the next day.`;
}

/** 7–15 digits, optionally written with +, spaces, brackets and dashes. */
export function isValidPhone(value: string): boolean {
  const phone = value.trim();
  const digits = phone.replace(/\D/g, '');
  return /^\+?[\d\s()-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
}

/**
 * The delivery-fee box, as typed or as the app writes it back: "150", "150.5",
 * "Rs. 150", "Rs 1,250.50". Anything else is NaN, so a typo can never be saved
 * as a different amount — stripping every non-digit turned 150.5 into 1505.
 */
export function parseDeliveryFee(text: string): number {
  const amount = text.trim().replace(/^(?:rs\.?|lkr)\s*/i, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amount)) return NaN;
  return Number(amount.replace(/,/g, ''));
}

/** 150 → "Rs. 150", 150.5 → "Rs. 150.50" — how Figma writes it (394:2865). */
export function formatDeliveryFee(fee: number): string {
  return `Rs. ${Number.isInteger(fee) ? fee : fee.toFixed(2)}`;
}

/** "1", "1.5", "2 km" → km; anything else → NaN. */
export function parseKm(text: string): number {
  const value = text.trim().replace(/\s*km$/i, '');
  return /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
}

/** An optional rupee amount: blank → null, otherwise parseDeliveryFee. */
export function parseOptionalAmount(text: string): number | null {
  return text.trim() ? parseDeliveryFee(text) : null;
}

/** Restaurant Info's delivery terms (Merchant.deliveryRules + freeDeliveryOver). */
export type DeliveryTermsInput = {
  deliveryAvailable: boolean;
  pricing: 'flat' | 'distance';
  freeKm: number;
  perKm: number;
  limitArea: boolean;
  maxKm: number;
  /** null = no order-value waiver. */
  freeOver: number | null;
  hasPin: boolean;
};

export type DeliveryTermsField = 'freeKm' | 'perKm' | 'maxKm' | 'freeOver' | 'deliveryPin';

export const DELIVERY_TERMS_MESSAGES: Record<DeliveryTermsField, string> = {
  freeKm: 'Enter the free-delivery distance in km, e.g. 1 (0 for none). It must be inside your delivery area.',
  perKm: 'Enter the charge per km, e.g. Rs. 50.',
  maxKm: 'Enter how far you deliver, from 0.5 to 100 km.',
  freeOver: 'Enter an order amount, e.g. Rs. 2000 — or leave it empty.',
  deliveryPin: 'Set your map pin (Location, above) — delivery distance is measured from it.',
};

/** What stops these delivery terms being saved. Nothing applies while delivery is off. */
export function deliveryTermsErrors(input: DeliveryTermsInput): Set<DeliveryTermsField> {
  const invalid = new Set<DeliveryTermsField>();
  if (!input.deliveryAvailable) return invalid;
  const distance = input.pricing === 'distance';
  const maxOk = Number.isFinite(input.maxKm) && input.maxKm >= 0.5 && input.maxKm <= 100;
  if (input.limitArea && !maxOk) invalid.add('maxKm');
  if (distance) {
    if (!(Number.isFinite(input.perKm) && input.perKm >= 0)) invalid.add('perKm');
    const freeOk = Number.isFinite(input.freeKm) && input.freeKm >= 0 && input.freeKm <= 100;
    if (!freeOk || (input.limitArea && maxOk && input.freeKm > input.maxKm)) invalid.add('freeKm');
  }
  if (input.freeOver !== null && !(Number.isFinite(input.freeOver) && input.freeOver > 0)) invalid.add('freeOver');
  if ((distance || input.limitArea) && !input.hasPin) invalid.add('deliveryPin');
  return invalid;
}

export type RestaurantField =
  | 'name'
  | 'cuisines'
  | 'tagline'
  | 'address'
  | 'phone'
  | 'openTime'
  | 'closeTime'
  | 'prepTime'
  | 'deliveryFee';

/** What each field says when it is wrong — shown under the field itself. */
export const RESTAURANT_FIELD_MESSAGES: Record<RestaurantField, string> = {
  name: 'Enter the restaurant name (at least 2 characters).',
  cuisines: 'Enter at least one cuisine, e.g. Sri Lankan.',
  tagline: 'Add a short description of your restaurant.',
  address: 'Enter the restaurant’s address.',
  phone: 'Enter a valid phone number (7–15 digits).',
  openTime: 'Enter the opening time, e.g. 7:00 AM, 7am or 07:00.',
  closeTime: 'Enter the closing time, e.g. 10:00 PM, 10pm or 22:00.',
  prepTime: 'Select an average preparation time.',
  deliveryFee: 'Enter a delivery fee, e.g. Rs. 150 (0 for free delivery).',
};

/**
 * Every field that would stop this restaurant being saved. Times must already
 * be in the stored "h:mm AM/PM" form — the screens pass them through
 * `normaliseTime` first, so what is checked is what gets written.
 */
export function invalidRestaurantFields(input: NewRestaurant): Set<RestaurantField> {
  const invalid = new Set<RestaurantField>();
  if (input.name.trim().length < 2) invalid.add('name');
  if (input.cuisines.length === 0 || input.cuisines.some((cuisine) => cuisine.trim().length < 2)) {
    invalid.add('cuisines');
  }
  if (!input.tagline.trim()) invalid.add('tagline');
  if (!input.address.trim()) invalid.add('address');
  if (!isValidPhone(input.phone)) invalid.add('phone');
  if (!isValidTime(input.openTime)) invalid.add('openTime');
  if (!isValidTime(input.closeTime)) invalid.add('closeTime');
  if (
    !Number.isFinite(input.prepTimeMin) || input.prepTimeMin <= 0 ||
    !Number.isFinite(input.prepTimeMax) || input.prepTimeMax < input.prepTimeMin
  ) {
    invalid.add('prepTime');
  }
  if (input.deliveryAvailable && !(Number.isFinite(input.deliveryFee) && input.deliveryFee >= 0)) {
    invalid.add('deliveryFee');
  }
  return invalid;
}

/** The fields each Add Restaurant step collects: Basic Info, Location, Hours, Orders. */
export const RESTAURANT_STEP_FIELDS: RestaurantField[][] = [
  ['name', 'cuisines', 'tagline'],
  ['address', 'phone'],
  ['openTime', 'closeTime'],
  ['prepTime', 'deliveryFee'],
];

/** The messages of the invalid fields in `fields`, in order — one sentence each. */
function messagesFor(fields: RestaurantField[], invalid: Set<RestaurantField>): string | null {
  const messages = fields.filter((field) => invalid.has(field)).map((field) => RESTAURANT_FIELD_MESSAGES[field]);
  return messages.length ? messages.join(' ') : null;
}

/** One message (or null) per Add Restaurant step: Basic Info, Location, Hours, Orders. */
export function restaurantStepErrors(input: NewRestaurant): Array<string | null> {
  const invalid = invalidRestaurantFields(input);
  return RESTAURANT_STEP_FIELDS.map((fields) => messagesFor(fields, invalid));
}

/**
 * What is wrong with one day's hours on Restaurant Information, or null. A
 * closed day needs nothing; an open one needs two readable times.
 */
export function dayHoursError(hours: DayHours): string | null {
  if (hours.closed) return null;
  const open = normaliseTime(hours.open) !== null;
  const close = normaliseTime(hours.close) !== null;
  if (open && close) return null;
  if (!open && !close) return 'Enter opening and closing times, e.g. 7:00 AM – 10:00 PM.';
  return open ? 'Enter a closing time, e.g. 10:00 PM or 22:00.' : 'Enter an opening time, e.g. 7:00 AM or 07:00.';
}

/**
 * Restaurant Information edits hours per day: every day that is open needs a
 * valid opening and closing time. Returns the days that don't have them.
 */
export function invalidHoursDays<D extends string>(hours: Record<D, DayHours>): D[] {
  return (Object.keys(hours) as D[]).filter((day) => dayHoursError(hours[day]) !== null);
}

/**
 * Restaurant Information's save: the same checks as Add Restaurant, except
 * that hours are edited per day, so each OPEN day's times are checked instead
 * of the single opening/closing pair. `labels` names the days in the message
 * ("Opening hours: check Wed, Sun.").
 */
export function restaurantEditErrors<D extends string>(
  input: Omit<NewRestaurant, 'openTime' | 'closeTime' | 'closedDays'>,
  hours: Record<D, DayHours>,
  labels?: Partial<Record<D, string>>
): { messages: string[]; fields: Set<RestaurantField>; days: D[] } {
  const fields = invalidRestaurantFields({ ...input, openTime: '', closeTime: '', closedDays: [] });
  fields.delete('openTime');
  fields.delete('closeTime');
  const days = invalidHoursDays(hours);
  const messages = [...fields].map((field) => RESTAURANT_FIELD_MESSAGES[field]);
  if (days.length) {
    fields.add('openTime');
    fields.add('closeTime');
    const names = days.map((day) => labels?.[day] ?? day).join(', ');
    messages.push(`Opening hours: enter valid times for ${names}.`);
  }
  return { messages, fields, days };
}

/**
 * What stops a restaurant opening for orders, judged from its saved hours:
 * at least one open day, and readable times on every open day. Empty when the
 * hours are fine. The menu half of the checklist lives with the menu.
 */
export function openingHoursProblems(hours: Partial<Record<string, DayHours>> | undefined): string[] {
  const days = Object.values(hours ?? {}).filter((h): h is DayHours => Boolean(h));
  const open = days.filter((h) => !h.closed);
  if (open.length === 0) return ['Set at least one day with opening hours.'];
  if (open.some((h) => dayHoursError(h) !== null)) return ['Fix the opening hours — every open day needs valid times.'];
  return [];
}
