/**
 * A-Z Globe design tokens.
 *
 * Every value here is MEASURED from the Figma file (hwAIsP8GcASfiHLmozX1eQ), not
 * invented. Re-derive them any time with:
 *
 *     node tools/figma-spec.mjs --tokens
 *
 * Rule: no component may hardcode a colour, font size, radius or shadow. If a
 * value is missing here, measure it from Figma and add it here first.
 */

// ── Palette ────────────────────────────────────────────────────────────────
// Raw values, ordered by how often they appear across the screens we build.
const palette = {
  white: '#FFFFFF',
  black: '#000000',

  red600: '#D42B2B', // brand primary — 143 uses
  red50: '#FFF1F1', // primary tint (selected chips, icon wells)
  orange500: '#FF6B35', // offer-banner gradient end
  red700: '#B00000',

  amber400: '#FBBF24', // stars — 146 uses
  amber500: '#FFB900',
  amber300: '#FFDF20',
  orange600: '#FF6900',

  green500: '#22C55E', // order-progress complete — 41 uses
  green50: '#DCFCE7',

  gray900: '#101828',
  gray850: '#111827',
  gray800: '#1F2937', // default text — 137 uses
  gray700: '#374151',
  gray600: '#4B5563',
  gray500: '#6B7280', // secondary text — 97 uses
  gray400: '#9CA3AF', // muted text — 77 uses
  gray300: '#D1D5DB',
  gray200: '#E5E7EB', // borders — 71 uses
  gray100: '#F3F4F6', // alt surface — 80 uses
  gray50: '#F9FAFB',

  ink: '#1A1A1A',
  slate900: '#0F172A',

  // Status accents used by badges in the order lifecycle
  blue600: '#0288D1',
  amberSoft: '#FFCC80',
  pink400: '#F06292',
  cream: '#FFF7F0',

  // Order History outcome/notice banners and history badges — Figma 346:3748
  green600: '#16A34A',
  green700: '#15803D',
  green25: '#F0FDF4',
  green200: '#BBF7D0',
  amber50: '#FFFBEB',
  amber200: '#FDE68A',
  amber600: '#D97706',
  amber800: '#92400E',
  amber700: '#F59E0B',
  red100: '#FFEAEA',
  red300: '#FF7A7A',
  red25: '#FFF0F0',
} as const;

// ── Semantic colours ───────────────────────────────────────────────────────
export const colors = {
  primary: palette.red600,
  primaryTint: palette.red50,
  primaryDark: palette.red700,
  onPrimary: palette.white,

  star: palette.amber400,
  starEmpty: palette.gray200,

  success: palette.green500,
  successTint: palette.green50,

  text: palette.gray800,
  textStrong: palette.gray850,
  textHeading: palette.gray900,
  textSecondary: palette.gray500,
  textMuted: palette.gray400,
  textInverse: palette.white,

  surface: palette.white,
  surfaceAlt: palette.gray100,
  surfaceSunken: palette.gray50,
  background: palette.white,

  border: palette.gray200,
  borderStrong: palette.gray300,
  divider: palette.gray200,

  scrim: 'rgba(0,0,0,0.45)',
  overlay: 'rgba(0,0,0,0.5)',

  status: {
    info: palette.blue600,
    warning: palette.amberSoft,
    danger: palette.red600,
    neutral: palette.gray400,
  },

  palette,
} as const;

// ── Gradients ──────────────────────────────────────────────────────────────
// Tuples feed straight into <LinearGradient colors={...} />.
export const gradients = {
  offerBanner: [palette.red600, palette.orange500] as const,
  amber: [palette.amber500, palette.orange600] as const,
  amberSoft: [palette.amber300, palette.amber500] as const,
  green: ['#A8E063', '#56AB2F'] as const,
  peach: ['#FFB86A', '#FF6467'] as const,
  /**
   * Offer card backgrounds — the eight swatches on "Customize Look" (370:3714),
   * drawn at ~151°. Keys are what an offer stores in `look.background`.
   */
  offerSunset: ['#E53E3E', '#F97316'] as const,
  offerGrape: ['#7C3AED', '#EC4899'] as const,
  offerOcean: ['#0EA5E9', '#10B981'] as const,
  offerLime: ['#16A34A', '#84CC16'] as const,
  offerNavy: ['#1E3A8A', '#3B82F6'] as const,
  offerCrimson: ['#7F1D1D', '#D42B2B'] as const,
  offerAmber: ['#D97706', '#FBBF24'] as const,
  offerSlate: ['#1F2937', '#4B5563'] as const,
  /** Bottom-up scrim over restaurant hero images. */
  imageScrim: ['rgba(0,0,0,0.80)', 'rgba(0,0,0,0.20)', 'rgba(0,0,0,0)'] as const,
  imageScrimSoft: ['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0)'] as const,
} as const;

// ── Typography ─────────────────────────────────────────────────────────────
// Urbanist only. Weight maps to a concrete loaded font file — React Native does
// not synthesise weights reliably across platforms, so we always name the face.
export const fontFamily = {
  400: 'Urbanist_400Regular',
  500: 'Urbanist_500Medium',
  600: 'Urbanist_600SemiBold',
  700: 'Urbanist_700Bold',
  800: 'Urbanist_800ExtraBold',
  900: 'Urbanist_900Black',
} as const;

export type FontWeight = keyof typeof fontFamily;

/**
 * Build a text style. Figma uses a 1.5x line height almost everywhere; pass an
 * explicit `lineHeight` for the handful of nodes that do not (e.g. 13/16.25).
 */
export function text(size: number, weight: FontWeight, lineHeight?: number) {
  return {
    fontFamily: fontFamily[weight],
    fontSize: size,
    lineHeight: lineHeight ?? size * 1.5,
  } as const;
}

/**
 * Named presets for the combinations that actually recur in the design, with
 * the Figma usage count that justifies each one.
 */
export const typography = {
  /**
   * Provider screen titles — "Vanan's Dashboard" (385:3033), "Restaurant
   * Management" (385:3424), the restaurant name on the hub (385:5072). Larger
   * than the customer h1 because the provider screens lead with them.
   */
  display: text(24, 700), // 24/36
  // Provider page titles — Order History, Offers & Discounts, Reviews (22/33).
  pageTitle: text(22, 700),

  /** Screen titles — "Order Food", "Your Cart", "Checkout" */
  h1: text(20, 700), // 20/30
  h2: text(18, 700), // 18/27
  h3: text(16, 700), // 16/24
  /** Section headings — "Our Services", "Popular Dishes" */
  h4: text(15, 700), // 15/22.5  (27 uses)
  h5: text(14, 700), // 14/21

  /** Card titles — dish and restaurant names */
  cardTitle: text(13, 700, 18), // 13/18   (12 uses)
  price: text(13, 700, 19.5), // 13/19.5 (14 uses)
  /** The heavier price on the provider menu cards (176:2923). */
  priceLg: text(14, 800), // 14/21

  bodyLg: text(14, 500), // 14/21
  body: text(13, 500), // 13/19.5
  bodySm: text(12, 500), // 12/18   (30 uses)
  bodyRegular: text(12, 400), // 12/18   (32 uses)

  label: text(12, 600), // 12/18   (29 uses)
  labelLg: text(14, 600), // 14/21   (32 uses)
  labelSm: text(11, 600), // 11/16.5

  /** Meta lines — merchant name above a dish, "2 days ago" */
  caption: text(10, 500), // 10/15   (68 uses — the single most common style)
  captionTight: text(10, 500, 14), // 10/14 — 2-line dish descriptions
  captionBold: text(10, 600), // 10/15
  captionRegular: text(10, 400), // 10/15

  micro: text(11, 500), // 11/16.5 (25 uses)
  microRegular: text(11, 400), // 11/16.5

  /**
   * Provider-side eyebrow labels — the tracked, muted headings that organise
   * the supplier screens ("Active Services" 385:3033, "Restaurant Name *"
   * 385:4028). The customer screens never use them.
   */
  eyebrow: { ...text(11, 700, 16.5), letterSpacing: 0.55 },
  eyebrowSm: { ...text(10, 700, 15), letterSpacing: 0.55 },

  /** Pill badges — "Bestseller", "Open", "AZ" */
  badge: { ...text(9, 700, 13.5), letterSpacing: 0.22 },
  tabLabel: text(10, 500), // BottomNav labels
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────
// Ranked by real usage: 16 and 12 dominate padding; 6, 12, 3, 2, 4 dominate gaps.
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 3,
  1.5: 4,
  2: 5,
  2.5: 6,
  3: 8,
  3.5: 10,
  4: 12,
  5: 14,
  6: 16,
  7: 18,
  8: 20,
  9: 24,
  10: 25,
  12: 32,
} as const;

/** Standard horizontal gutter for full-width screen content. */
export const SCREEN_PADDING = 16;
/** Figma canvas width (iPhone 16). Use for ratio maths only — never as a fixed width. */
export const DESIGN_WIDTH = 393;

// ── Radii ──────────────────────────────────────────────────────────────────
export const radius = {
  xs: 3,
  sm: 5,
  md: 8,
  lg: 10, // 22 uses
  xl: 12, // 34 uses
  '2xl': 14, // 19 uses
  '3xl': 16, // 48 uses — the default card radius
  '4xl': 20,
  '5xl': 24,
  pill: 999, // by far the most common
} as const;

// ── Elevation ──────────────────────────────────────────────────────────────
// React Native 0.76+ on the New Architecture supports the CSS `boxShadow` prop,
// so Figma's multi-layer shadows map exactly instead of being approximated with
// shadowRadius/elevation.
export const shadows = {
  /** Dish, restaurant and summary cards. Figma: 0 0 0 .5 6% + 0 2 8 9% */
  card: {
    boxShadow: '0px 0px 0px 0.5px rgba(0,0,0,0.06), 0px 2px 8px 0px rgba(0,0,0,0.09)',
  },
  /** Chips, small buttons. Figma: 0 1 3 10% + 0 1 2 -1 10% */
  raised: {
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px -1px rgba(0,0,0,0.10)',
  },
  /** Floating action / circular buttons. Figma: 0 4 6 -1 10% + 0 2 4 -2 10% */
  floating: {
    boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.10), 0px 2px 4px -2px rgba(0,0,0,0.10)',
  },
  /** Sticky bottom bars — shadow points upward. */
  bottomBar: {
    boxShadow: '0px -1px 6px 0px rgba(0,0,0,0.07)',
  },
  soft: {
    boxShadow: '0px 1px 4px 0px rgba(0,0,0,0.06)',
  },
  /** Provider list cards — Order History (346:3748). */
  listCard: {
    boxShadow: '0px 1px 4px 0px rgba(0,0,0,0.08)',
  },
  none: {},
} as const;

// ── Motion ─────────────────────────────────────────────────────────────────
export const duration = { fast: 150, base: 220, slow: 320 } as const;

export const theme = {
  colors,
  gradients,
  typography,
  fontFamily,
  text,
  spacing,
  radius,
  shadows,
  duration,
  SCREEN_PADDING,
  DESIGN_WIDTH,
} as const;

export type Theme = typeof theme;
