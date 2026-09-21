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

export const landingCategories: Array<{ key: CategoryKey; label: string }> = [
  { key: 'dine-out', label: 'Dine Out' },
  { key: 'rice-curry', label: 'Rice & Curry' },
  { key: 'kottu', label: 'Kottu' },
  { key: 'seafood', label: 'Seafood' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'desserts', label: 'Desserts' },
  { key: 'quick-bites', label: 'Quick Bites' },
  { key: 'pizza', label: 'Pizza' },
];
