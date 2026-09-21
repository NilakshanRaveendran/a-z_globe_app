import type { ImageSourcePropType } from 'react-native';

/**
 * The A-Z Globe mark, generated from the logo master by
 * `python tools/make-brand-assets.py`.
 *
 * It lives in core rather than in an app because every A-Z app — customer,
 * provider, and whatever follows — signs in under the same brand.
 */
export const brandMark: ImageSourcePropType = require('../assets/brand/az-mark.png');

/** Mark plus the "GLOBE" wordmark, for splash-sized placements. */
export const brandLockup: ImageSourcePropType = require('../assets/brand/az-lockup.png');
