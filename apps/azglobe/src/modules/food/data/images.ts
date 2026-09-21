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
  'merchant-mamas-kitchen': require('../../../../assets/images/food/merchant-mamas-kitchen.jpg'),
  'merchant-mamas-kitchen-wide': require('../../../../assets/images/food/merchant-mamas-kitchen-wide.png'),
  'merchant-namma-ooru-cafe': require('../../../../assets/images/food/merchant-namma-ooru-cafe.jpg'),
  'merchant-trinco-blu': require('../../../../assets/images/food/merchant-trinco-blu.jpg'),
  'merchant-trinco-blu-restaurant': require('../../../../assets/images/food/merchant-trinco-blu-restaurant.jpg'),
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
