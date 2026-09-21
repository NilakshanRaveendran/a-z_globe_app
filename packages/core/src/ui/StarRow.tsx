import { Pressable, StyleSheet, View } from 'react-native';
import StarIcon from '../../assets/icons/ui/star.svg';
import { colors, spacing } from '@core/theme';

export type StarRowProps = {
  /** 0–5, fractional values round to the nearest whole star. */
  rating: number;
  /** Figma uses 10px on cards and 20px+ in the review sheet. */
  size?: number;
  gap?: number;
  /** Makes the row tappable for the Write-a-Review sheet. */
  onRate?: (rating: number) => void;
};

/**
 * Figma: 5 × 10px stars, gap 2, filled #FBBF24 / empty #E5E7EB.
 * The glyph is the designer's own vector exported from Figma.
 */
export function StarRow({ rating, size = 10, gap = spacing[0.5], onRate }: StarRowProps) {
  const filled = Math.round(rating);

  return (
    <View
      style={[styles.row, { gap }]}
      accessibilityRole={onRate ? 'adjustable' : 'image'}
      accessibilityLabel={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const star = (
          <StarIcon width={size} height={size} color={i <= filled ? colors.star : colors.starEmpty} />
        );
        return onRate ? (
          <Pressable key={i} onPress={() => onRate(i)} hitSlop={6}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
