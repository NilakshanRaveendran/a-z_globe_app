import type { ComponentProps, ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type Svg from 'react-native-svg';
import { colors, fontFamily, gradients, radius } from '@core/theme';
import { Text } from '@core/ui';
import Burger from '../../../../assets/icons/offers/burger.svg';
import Pizza from '../../../../assets/icons/offers/pizza.svg';
import Coffee from '../../../../assets/icons/offers/coffee.svg';
import Cake from '../../../../assets/icons/offers/cake.svg';
import Noodles from '../../../../assets/icons/offers/noodles.svg';
import Gift from '../../../../assets/icons/offers/gift.svg';
import SouthIndian from '../../../../assets/icons/offers/southIndian.svg';
import NorthIndian from '../../../../assets/icons/offers/northIndian.svg';
import Chinese from '../../../../assets/icons/offers/chinese.svg';
import Tandoori from '../../../../assets/icons/offers/tandoori.svg';
import type { OfferLook } from '../types';

/**
 * A restaurant's offer card — the card a supplier designs on "Customize Look"
 * (Figma 370:3714) and customers see on the restaurant page.
 *
 *   large    140h · r18 · gradient ~151° · two white-10% circles top/bottom
 *            right · kicker 600 9/13 ls1 white 70% · headline 800 16/20 white
 *            (left block pad-left 18, clear of the art) · discount pill top
 *            right: white 20% r8 pad 3/8, 800 12/18 · 95pt illustration at 92%
 *   compact  72h · r10 · kicker 600 7/10 · headline 800 10/12.5 ≤116w · 60pt art ·
 *            no pill — the Offers & Discounts list thumbnail (352:6239)
 */

export const OFFER_BACKGROUNDS = {
  sunset: gradients.offerSunset,
  grape: gradients.offerGrape,
  ocean: gradients.offerOcean,
  lime: gradients.offerLime,
  navy: gradients.offerNavy,
  crimson: gradients.offerCrimson,
  amber: gradients.offerAmber,
  slate: gradients.offerSlate,
} as const;
export type OfferBackground = keyof typeof OFFER_BACKGROUNDS;

export const OFFER_ILLUSTRATIONS: Record<string, { label: string; Art: ComponentType<ComponentProps<typeof Svg>> }> = {
  burger: { label: 'Burger', Art: Burger },
  pizza: { label: 'Pizza', Art: Pizza },
  coffee: { label: 'Coffee', Art: Coffee },
  cake: { label: 'Cake', Art: Cake },
  noodles: { label: 'Noodles', Art: Noodles },
  gift: { label: 'Gift', Art: Gift },
  southIndian: { label: 'South Indian', Art: SouthIndian },
  northIndian: { label: 'North Indian', Art: NorthIndian },
  chinese: { label: 'Chinese', Art: Chinese },
  tandoori: { label: 'Tandoori', Art: Tandoori },
};

export const DEFAULT_LOOK: OfferLook = {
  label: 'LIMITED TIME OFFER',
  background: 'sunset',
  illustration: 'burger',
};

// CSS 151° (Figma) as a start→end vector across the card.
const START = { x: 0.26, y: 0.06 };
const END = { x: 0.74, y: 0.94 };

export function OfferCard({
  look,
  headline,
  subtitle,
  badge,
  size = 'large',
}: {
  look: OfferLook;
  headline: string;
  /** Separate validity line below the offer headline. */
  subtitle?: string;
  /** "20% OFF" pill, top right. Large cards only. */
  badge?: string;
  size?: 'large' | 'compact';
}) {
  const large = size === 'large';
  const colorsPair =
    OFFER_BACKGROUNDS[look.background as OfferBackground] ?? OFFER_BACKGROUNDS.sunset;
  const Art = (OFFER_ILLUSTRATIONS[look.illustration] ?? OFFER_ILLUSTRATIONS.burger!).Art;
  const artSize = large ? 95 : 60;

  return (
    <LinearGradient
      colors={colorsPair}
      start={START}
      end={END}
      style={[styles.card, large ? styles.cardLarge : styles.cardCompact]}
    >
      <View style={[styles.circle, large ? styles.circleTopL : styles.circleTopS]} />
      <View style={[styles.circle, large ? styles.circleBottomL : styles.circleBottomS]} />

      <View style={[styles.copy, large ? styles.copyL : styles.copyS]}>
        {look.label ? (
          <Text style={large ? styles.kickerL : styles.kickerS} numberOfLines={1}>
            {look.label.toUpperCase()}
          </Text>
        ) : null}
        <Text style={large ? styles.headlineL : styles.headlineS} numberOfLines={large ? 3 : 2}>
          {headline}
        </Text>
        {subtitle ? <Text style={large ? styles.subtitleL : styles.subtitleS}>{subtitle}</Text> : null}
      </View>

      {large && badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      <View style={[styles.art, large ? styles.artL : styles.artS]}>
        <Art width={artSize} height={artSize} />
      </View>
    </LinearGradient>
  );
}

const WHITE = colors.onPrimary;

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden' },
  cardLarge: { height: 140, borderRadius: 18 },
  cardCompact: { height: 72, borderRadius: radius.lg },
  circle: { position: 'absolute', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)' },
  circleTopL: { width: 100, height: 100, right: -24, top: -24 },
  circleBottomL: { width: 80, height: 80, right: -8, top: 92 },
  circleTopS: { width: 60, height: 60, right: -24, top: -24 },
  circleBottomS: { width: 48, height: 48, right: -8, top: 56 },
  copy: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
  copyL: { paddingLeft: 18, right: 96 },
  copyS: { paddingLeft: 12, right: 60 },
  kickerL: {
    fontFamily: fontFamily[600],
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
    paddingBottom: 2,
  },
  kickerS: {
    fontFamily: fontFamily[600],
    fontSize: 7,
    lineHeight: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
    paddingBottom: 2,
  },
  headlineL: { fontFamily: fontFamily[800], fontSize: 16, lineHeight: 20, color: WHITE },
  subtitleL: { fontFamily: fontFamily[500], fontSize: 14, lineHeight: 20, color: WHITE, marginTop: 6 },
  subtitleS: { fontFamily: fontFamily[500], fontSize: 10, lineHeight: 14, color: WHITE, marginTop: 2 },
  // Figma hand-sizes each thumbnail's text box (85 and 116 wide on 352:6743);
  // 116 is the widest, so longer headlines wrap as drawn instead of running on.
  headlineS: { fontFamily: fontFamily[800], fontSize: 10, lineHeight: 12.5, color: WHITE, maxWidth: 116 },
  badge: {
    position: 'absolute',
    right: 16,
    top: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: { fontFamily: fontFamily[800], fontSize: 12, lineHeight: 18, color: WHITE },
  art: { position: 'absolute', opacity: 0.92 },
  artL: { right: 0, top: 45 },
  artS: { right: 0, top: 12 },
});
