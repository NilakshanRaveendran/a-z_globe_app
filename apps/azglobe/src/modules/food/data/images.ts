import type { ImageSourcePropType } from 'react-native';

/**
 * Photography exported from the Figma file. This is the design's own placeholder
 * content — in production these URLs come from Firestore / Cloud Storage. The
 * fixtures reference images by key so the same catalogue feeds both the local
 * fixture store and `tools/seed.mjs`.
 */
export const foodImages = {
  'kottu': require('../../../../assets/images/food/kottu.jpg'),
  'kottu-hero': require('../../../../assets/images/food/kottu-hero.jpg'),
  'dosa': require('../../../../assets/images/food/dosa.jpg'),
  'dosa-platter': require('../../../../assets/images/food/dosa-platter.jpg'),
  'samosa': require('../../../../assets/images/food/samosa.jpg'),
  'samosa-alt': require('../../../../assets/images/food/samosa-alt.jpg'),
  'rotty-set': require('../../../../assets/images/food/rotty-set.jpg'),
  'rotty-set-alt': require('../../../../assets/images/food/rotty-set-alt.jpg'),
  'pol-sambol-rice': require('../../../../assets/images/food/pol-sambol-rice.jpg'),
  'curry-roti': require('../../../../assets/images/food/curry-roti.jpg'),
  'pancakes': require('../../../../assets/images/food/pancakes.jpg'),
  // Lime Juice row on All Menu Items (26:10198). The file historically saved as
  // `pol-sambol-rice.jpg` is this same photo; the key stays for saved menus.
  'lime-juice': require('../../../../assets/images/food/lime-juice.jpg'),
  'merchant-mamas-kitchen': require('../../../../assets/images/food/merchant-mamas-kitchen.jpg'),
  'merchant-mamas-kitchen-wide': require('../../../../assets/images/food/merchant-mamas-kitchen-wide.jpg'),
  'merchant-namma-ooru-cafe': require('../../../../assets/images/food/merchant-namma-ooru-cafe.jpg'),
  'merchant-trinco-blu': require('../../../../assets/images/food/merchant-trinco-blu.jpg'),
  'merchant-trinco-blu-restaurant': require('../../../../assets/images/food/merchant-trinco-blu-restaurant.jpg'),
  // Menu Management dish photos — Figma 176:2923. Mango Lassi and Chocolate
  // Lava Cake are portrait shots Figma crops to the card; that crop is baked in.
  'grilled-chicken-burger': require('../../../../assets/images/food/grilled-chicken-burger.jpg'),
  'margherita-pizza': require('../../../../assets/images/food/margherita-pizza.jpg'),
  'spicy-tuna-roll': require('../../../../assets/images/food/spicy-tuna-roll.jpg'),
  'mix-nasi-goreng': require('../../../../assets/images/food/mix-nasi-goreng.jpg'),
  'caesar-salad': require('../../../../assets/images/food/caesar-salad.jpg'),
  'mango-lassi': require('../../../../assets/images/food/mango-lassi.jpg'),
  'chocolate-lava-cake': require('../../../../assets/images/food/chocolate-lava-cake.jpg'),
} as const;

export type FoodImageKey = keyof typeof foodImages;

/**
 * Resolve an image reference to something <Image/> accepts. Fixtures store a
 * bundled-asset key; Firestore stores an https URL. Both flow through here so
 * components never branch on where their data came from.
 */
export function resolveImage(ref: string): ImageSourcePropType {
  if (ref.startsWith('http')) return { uri: ref };
  const asset = foodImages[ref as FoodImageKey];
  return asset ?? foodImages['kottu'];
}
