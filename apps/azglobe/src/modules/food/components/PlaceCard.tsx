import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Icon, StarRow, Text } from '@core/ui';
import { colors, gradients, radius, shadows, spacing } from '@core/theme';
import { formatDistance } from '@core/utils/currency';
import { resolveImage } from '../data/images';

export type PlaceCardProps = {
  name: string;
  /** "Restaurant", "Hotel" — the category line under the name. */
  category: string;
  image: string;
  rating: number;
  /** 0 means nobody has reviewed it yet — the card shows "New" instead of 0.0. */
  reviewCount?: number;
  distanceKm: number;
  isOpen: boolean;
  onPress: () => void;
  /** 'hero' is the full-width 140pt card; 'tile' is the 160×200 pair below it. */
  size?: 'hero' | 'tile';
  style?: ViewStyle;
};

/**
 * Image card with a bottom-up scrim, used by "Popular Near You" (Home 324:1708).
 *
 * Figma:
 *   hero  361×140 · r16 · scrim #000 75% -> 30% -> 0% · title 16/20 700
 *   tile  160×200 · r16 · scrim #000 80% -> 20% -> 0% · title 14/17.5 700
 *   Open/Closed pill top-left: pad 3/8 · r:pill · #D42B2B (open) / dark (closed)
 */
export function PlaceCard({
  name,
  category,
  image,
  rating,
  reviewCount = 0,
  distanceKm,
  isOpen,
  onPress,
  size = 'tile',
  style,
}: PlaceCardProps) {
  const hero = size === 'hero';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        hero ? styles.hero : styles.tile,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Image source={resolveImage(image)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <LinearGradient
        colors={hero ? gradients.imageScrimSoft : gradients.imageScrim}
        locations={[0, 0.5, 1]}
        // Figma draws the scrim bottom-up: opaque at the base, clear at the top.
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.statusPill, isOpen ? styles.openPill : styles.closedPill]}>
        <Text variant="captionBold" color={colors.onPrimary}>
          {isOpen ? 'Open' : 'Closed'}
        </Text>
      </View>

      <View style={[styles.body, { padding: hero ? spacing[5] : spacing[4] }]}>
        <Text
          variant={hero ? 'h3' : 'h5'}
          color={colors.textInverse}
          numberOfLines={1}
          style={hero ? styles.heroTitle : styles.tileTitle}
        >
          {name}
        </Text>
        <Text variant={hero ? 'bodySm' : 'micro'} color="rgba(255,255,255,0.70)" numberOfLines={1}>
          {category}
        </Text>

        <View style={[styles.meta, hero ? styles.metaHero : styles.metaTile]}>
          <View style={styles.metaItem}>
            {/* See FeaturedCard: an unrated restaurant shows "New", not 0.0. */}
            {reviewCount === 0 ? (
              <Text variant="labelSm" color={colors.textInverse}>
                New
              </Text>
            ) : (
              <>
                <StarRow rating={rating} size={10} />
                <Text variant="labelSm" color={colors.textInverse}>
                  {rating.toFixed(1)}
                </Text>
              </>
            )}
          </View>
          <View style={styles.metaItem}>
            <Icon name="mapPin" size={10} color={colors.textInverse} />
            <Text variant="micro" color="rgba(255,255,255,0.80)">
              {formatDistance(distanceKm)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceAlt,
    ...shadows.raised,
  },
  hero: { height: 140, alignSelf: 'stretch' },
  tile: { flex: 1, height: 200 },
  pressed: { opacity: 0.92 },
  statusPill: {
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  openPill: { backgroundColor: colors.primary },
  closedPill: { backgroundColor: 'rgba(0,0,0,0.55)' },
  body: { gap: spacing[1.5] },
  // Figma tightens the line height on these overlay titles.
  heroTitle: { lineHeight: 20 },
  tileTitle: { lineHeight: 17.5 },
  meta: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing[0.5] },
  metaHero: { gap: spacing[3.5] },
  metaTile: { justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
});
