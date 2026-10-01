/**
 * The design writes prices as "Rs. 450", "Rs. 1,280", "+Rs. 400" and "Rs. 80".
 * Always format through here so no screen invents its own spacing or separator.
 */
export function formatMoney(amount: number): string {
  return `Rs. ${amountText(amount)}`;
}

/** Option deltas render as "+Rs. 400". */
export function formatDelta(amount: number): string {
  if (amount === 0) return '';
  const sign = amount > 0 ? '+' : '-';
  return `${sign}Rs. ${amountText(Math.abs(amount))}`;
}

/**
 * Whole rupees as the design draws them ("1,280"); cents only when a supplier
 * has priced something in them ("12.50") so a total never silently rounds.
 */
function amountText(amount: number): string {
  const cents = Math.round(amount * 100);
  return (cents / 100).toLocaleString('en-US', cents % 100 === 0
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "20–30 min" — note the en dash used throughout the design. */
export function formatPrepTime(min: number, max: number): string {
  return `${min}–${max} min`;
}

/** "1.2 km" */
export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}
