/**
 * The cuisine chips and category circles use multi-colour illustrations drawn in
 * Figma. Unlike the monochrome UI glyphs these keep their own fills, so they are
 * exported with `--keep-colors` and never recoloured.
 */
import CuisineAll from '../../../../assets/icons/cuisine/all.svg';
import CuisineSriLankan from '../../../../assets/icons/cuisine/sri-lankan.svg';
import CuisineCafe from '../../../../assets/icons/cuisine/cafe.svg';
import CuisineSeafood from '../../../../assets/icons/cuisine/seafood.svg';

import CatDineOut from '../../../../assets/icons/category/dine-out.svg';
import CatRiceCurry from '../../../../assets/icons/category/rice-curry.svg';
import CatKottu from '../../../../assets/icons/category/kottu.svg';
import CatSeafood from '../../../../assets/icons/category/seafood.svg';
import CatDrinks from '../../../../assets/icons/category/drinks.svg';
import CatDesserts from '../../../../assets/icons/category/desserts.svg';
import CatQuickBites from '../../../../assets/icons/category/quick-bites.svg';
import CatPizza from '../../../../assets/icons/category/pizza.svg';

export const cuisineIcons = {
  all: CuisineAll,
  'sri-lankan': CuisineSriLankan,
  cafe: CuisineCafe,
  seafood: CuisineSeafood,
} as const;

export const categoryIcons = {
  'dine-out': CatDineOut,
  'rice-curry': CatRiceCurry,
  kottu: CatKottu,
  seafood: CatSeafood,
  drinks: CatDrinks,
  desserts: CatDesserts,
  'quick-bites': CatQuickBites,
  pizza: CatPizza,
} as const;

export type CuisineKey = keyof typeof cuisineIcons;
export type CategoryKey = keyof typeof categoryIcons;
