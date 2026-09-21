import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@core/ui';
import { colors, gradients, radius, spacing } from '@core/theme';

/**
 * The promotional banner on the restaurant menu tab — Figma 17:4787.
 *
 *   card    353×154 · r24 · gradient #D42B2B → #FF6B35 · pad 20/24
 *   kicker  "Limited time offer" Urbanist 600 12/16 ls1.2 #FFFFFF 80% (uppercase)
 *   title   Urbanist 800 20/25 #FFFFFF, two lines
 *   button  pill · #FFFFFF · "Order Now" Urbanist 700 12/16 #D42B2B
 *   glyph   72pt emoji at 25% opacity, bottom-right
 */
export function OfferBanner({
  kicker = 'Limited time offer',
  title,
  actionLabel = 'Order Now',
  glyph = '🍛',
  onPress,
}: {
  kicker?: string;
  title: string;
  actionLabel?: string;
  glyph?: string;
  onPress: () => void;
}) {
  return (
    <LinearGradient
      colors={gradients.offerBanner}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.body}>
        <Text variant="label" color="rgba(255,255,255,0.80)" style={styles.kicker}>
          {kicker.toUpperCase()}
        </Text>
        <Text variant="h1" color={colors.textInverse} style={styles.title}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text variant="label" color={colors.primary} style={styles.buttonLabel}>
            {actionLabel}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.glyph}>{glyph}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['5xl'],
    overflow: 'hidden',
  },
  body: { paddingHorizontal: spacing[9], paddingVertical: spacing[8] },
  kicker: { fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  title: {
    fontFamily: 'Urbanist_800ExtraBold',
    fontSize: 20,
    lineHeight: 25,
    paddingTop: spacing[1.5],
    paddingBottom: spacing[4],
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  buttonLabel: { fontFamily: 'Urbanist_700Bold', lineHeight: 16 },
  pressed: { opacity: 0.85 },
  glyph: {
    position: 'absolute',
    right: spacing[6],
    bottom: spacing[3],
    fontSize: 72,
    lineHeight: 72,
    opacity: 0.25,
  },
});
