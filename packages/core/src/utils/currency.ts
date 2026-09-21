/**
 * The design writes prices as "Rs. 450", "Rs. 1,280", "+Rs. 400" and "Rs. 80".
 * Always format through here so no screen invents its own spacing or separator.
 */
export function formatMoney(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString('en-US')}`;
}

/** Option deltas render as "+Rs. 400". */
export function formatDelta(amount: number): string {
  if (amount === 0) return '';
  const sign = amount > 0 ? '+' : '-';
  return `${sign}Rs. ${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;
}

/** "20–30 min" — note the en dash used throughout the design. */
export function formatPrepTime(min: number, max: number): string {
  return `${min}–${max} min`;
}

/** "1.2 km" */
export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}
