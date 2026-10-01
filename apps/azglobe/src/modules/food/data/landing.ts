import type { CategoryKey, CuisineKey } from './icons';

/**
 * The filter rows on the Order Food landing page (31:11648), in Figma's order.
 * Labels must match the design exactly.
 */
export const landingCuisines: Array<{ key: CuisineKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'sri-lankan', label: 'Sri Lankan' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'seafood', label: 'Seafood' },
];

/**
 * The category circles. Each filters restaurants by the cuisine in `cuisine`
 * (matched case-insensitively against `Merchant.cuisines`), and the landing
 * page hides a circle no listed restaurant serves — Figma's "Dine Out",
 * "Quick Bites" and "Pizza" used to lead to an empty page.
 */
export const landingCategories: Array<{ key: CategoryKey; label: string; cuisine: string }> = [
  { key: 'dine-out', label: 'Dine Out', cuisine: 'Dine Out' },
  { key: 'rice-curry', label: 'Rice & Curry', cuisine: 'Rice & Curry' },
  { key: 'kottu', label: 'Kottu', cuisine: 'Kottu' },
  { key: 'seafood', label: 'Seafood', cuisine: 'Seafood' },
  { key: 'drinks', label: 'Drinks', cuisine: 'Drinks' },
  { key: 'desserts', label: 'Desserts', cuisine: 'Desserts' },
  { key: 'quick-bites', label: 'Quick Bites', cuisine: 'Quick Bites' },
  { key: 'pizza', label: 'Pizza', cuisine: 'Pizza' },
];
