import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { colors, spacing } from '@core/theme';

export type StarRowProps = {
  /**
   * 0–5. Fractions snap to the nearest half, so 4.5 shows four and a half
   * stars and 4.2 shows four — an average must not round up to five.
   */
  rating: number;
  /** Figma uses 10px on cards and 20px+ in the review sheet. */
  size?: number;
  gap?: number;
  /** Makes the row tappable for the Write-a-Review sheet. */
  onRate?: (rating: number) => void;
};

/**
 * Figma: 5 × 10px stars, gap 2, filled #FBBF24 / empty #E5E7EB.
 * The glyph is the designer's own vector exported from Figma. A half star is
 * the empty glyph with the filled one clipped to its left half on top.
 */
export function StarRow({ rating, size = 10, gap = spacing[0.5], onRate }: StarRowProps) {
  const halves = Math.round(Math.max(0, Math.min(5, rating)) * 2);
  const label = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  return (
    <View
      style={[styles.row, { gap }]}
      accessibilityRole={onRate ? 'adjustable' : 'image'}
      accessibilityLabel={`${label} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = halves >= i * 2 ? 'full' : halves === i * 2 - 1 ? 'half' : 'empty';
        const star =
          fill === 'half' ? (
            <View style={{ width: size, height: size }}>
              <Icon name="star" size={size} color={colors.starEmpty} />
              <View style={[styles.halfClip, { width: size / 2, height: size }]}>
                <Icon name="star" size={size} color={colors.star} />
              </View>
            </View>
          ) : (
            <Icon name="star" size={size} color={fill === 'full' ? colors.star : colors.starEmpty} />
          );
        return onRate ? (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${i} star${i === 1 ? '' : 's'}`}
            onPress={() => onRate(i)}
            hitSlop={6}
          >
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
  halfClip: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
});
