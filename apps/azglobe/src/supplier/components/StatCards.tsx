import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@core/theme';
import { Icon, Text, type IconName } from '@core/ui';
import type { Merchant, Order } from '@modules/food/types';
import { listReviews, summarizeReviews, type RatingSummary } from '../services/reviews';
import { orderStats } from '../services/orders';

export type Stat = {
  value: string;
  label: string;
  icon: IconName;
  iconColor: string;
  /** The star is drawn 14pt; the box and trend glyphs 16pt. */
  iconSize?: number;
  /** Figma gives each card its own tint: #FFF0F0, #F0F4FF, #FFFBEB. */
  tint: string;
};

/**
 * "Rs.4.2k" — the compact figure the stat card shows (Figma 385:3078). A full
 * "Rs. 142,500" does not fit a 114pt card at 15pt bold.
 */
function compactMoney(amount: number): string {
  const n = Math.max(0, Math.round(amount));
  if (n < 1000) return `Rs.${n}`;
  const [scaled, unit] = n < 1_000_000 ? [n / 1000, 'k'] : [n / 1_000_000, 'M'];
  // One decimal while it carries information: 4.2k, 12k, 1.5M.
  const digits = scaled < 10 ? scaled.toFixed(1).replace(/\.0$/, '') : Math.round(scaled).toString();
  return `Rs.${digits}${unit}`;
}

/** How long a rating read from reviews is reused across the provider screens. */
const RATING_TTL_MS = 60_000;
const ratingCache = new Map<string, { at: number; summary: RatingSummary }>();

/**
 * Each restaurant's rating — the same figure the Reviews screen headlines.
 *
 * When the restaurant has counted its reviews (the review trigger in
 * functions/ keeps `rating`/`reviewCount` current), that is used as-is and
 * costs no reads. Until then — no review yet, or no Functions deployed — it is
 * computed from the reviews, and reused for a minute so moving between Home,
 * Restaurant Management and the hub doesn't re-read a page of reviews each time.
 */
export async function loadRatings(merchants: Merchant[]): Promise<Map<string, RatingSummary>> {
  const entries = await Promise.all(
    merchants.map(async (m): Promise<readonly [string, RatingSummary]> => {
      if ((m.reviewCount ?? 0) > 0) return [m.id, summarizeReviews([], m)];
      const cached = ratingCache.get(m.id);
      if (cached && Date.now() - cached.at < RATING_TTL_MS) return [m.id, cached.summary];
      const reviews = await listReviews(m.id).catch(() => null);
      if (!reviews) return [m.id, summarizeReviews([], m)];
      const summary = summarizeReviews(reviews, m);
      ratingCache.set(m.id, { at: Date.now(), summary });
      return [m.id, summary];
    })
  );
  return new Map(entries);
}

/** Review-weighted average across restaurants, or null when none is reviewed. */
export function averageRating(summaries: Iterable<RatingSummary>): number | null {
  let total = 0;
  let sum = 0;
  for (const s of summaries) {
    total += s.total;
    sum += s.average * s.total;
  }
  return total ? sum / total : null;
}

/**
 * The three cards both provider screens show — Orders Today · Revenue ·
 * Avg Rating — with the Figma glyph and tint for each.
 *
 * Pass the orders (what `listMerchantOrders(id)` returns — everything active
 * plus everything placed today) and the counting is done here, the one way
 * both screens need it (S18, see `orderStats`): Orders Today leaves out
 * cancelled and refunded orders; Revenue counts only orders the restaurant has
 * accepted and not cancelled or refunded — never one still 'new'. Pre-counted
 * figures are still accepted.
 *
 * `rating` is null when nothing has been reviewed: showing 0.0 would read as a
 * bad score rather than an absent one.
 */
export function businessStats(
  input:
    | { orders: Order[]; rating: number | null; now?: number }
    | { ordersToday: number; revenue: number; rating: number | null }
): Stat[] {
  const { ordersToday, revenue } = 'orders' in input ? orderStats(input.orders, input.now) : input;
  const { rating } = input;
  return [
    {
      value: String(ordersToday),
      label: 'Orders Today',
      icon: 'box',
      iconColor: colors.primary,
      tint: colors.palette.red25,
    },
    {
      value: compactMoney(revenue),
      label: 'Revenue',
      icon: 'trendingUp',
      iconColor: colors.palette.navy800,
      tint: colors.palette.blue25,
    },
    {
      value: rating === null ? '—' : rating.toFixed(1),
      label: 'Avg Rating',
      icon: 'star',
      iconColor: colors.star,
      iconSize: 14,
      tint: colors.palette.amber50,
    },
  ];
}

/**
 * The three-up stat row — Figma provider dashboard (385:3062) and restaurant
 * hub (385:5450), which use it identically.
 *
 *   row    3 columns · gap 8
 *   card   114x89.5 · r16 · pad 12 · gap 6
 *   glyph  16pt box #D42B2B · 16pt trend #112D4E · 14pt star #FBBF24
 *   value  Urbanist 700 15/22.5 #1F2937
 *   label  Urbanist 500 10/15 #6B7280
 */
export function StatCards({ items }: { items: Stat[] }) {
  return (
    <View style={styles.row}>
      {items.map((s) => (
        <View
          key={s.label}
          accessible
          accessibilityLabel={`${s.label}: ${s.value}`}
          style={[styles.card, { backgroundColor: s.tint }]}
        >
          <View style={styles.glyph}>
            <Icon name={s.icon} size={s.iconSize ?? 16} color={s.iconColor} />
          </View>
          <Text variant="h4" color={colors.text} numberOfLines={1}>
            {s.value}
          </Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  card: {
    flex: 1,
    minHeight: 89.5,
    borderRadius: radius['3xl'],
    padding: spacing[4],
    gap: spacing[2.5],
  },
  // Every glyph sits in a 16pt box so the 14pt star lines the values up too.
  glyph: { height: 16, justifyContent: 'center' },
});
