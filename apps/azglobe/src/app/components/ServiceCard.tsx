import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import type { ModuleDescriptor } from '@modules/types';

export type ServiceCardProps = {
  module: ModuleDescriptor;
  onPress: () => void;
};

/**
 * A tile in the Home "Our Services" grid. Renders a ModuleDescriptor, so adding
 * an A-Z module to the registry makes it appear here with no change to Home.
 *
 * Figma (324:2206 / 324:2210): 106×90 · r12 · #F3F4F6 · pad 12 · gap 12 ·
 * align center
 *   image 36×36 · label Urbanist 500 12/18 #1F2937 centred
 *
 * The art ships as one 288px file per service (assets/images/services), so the
 * 36pt image is sharp at any screen density, web included.
 */
export function ServiceCard({ module, onPress }: ServiceCardProps) {
  const comingSoon = module.status === 'coming-soon';

  // Coming-soon services remain visible, but are dimmed and cannot be opened.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={comingSoon ? `${module.title} — coming soon` : module.title}
      disabled={comingSoon}
      accessibilityState={{ disabled: comingSoon }}
      onPress={comingSoon ? undefined : onPress}
      style={({ pressed }) => [styles.card, comingSoon && styles.unavailable, pressed && styles.pressed]}
    >
      <Image source={module.icon} style={styles.icon} contentFit="contain" />
      <Text variant="bodySm" color={colors.text} align="center">
        {module.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
  },
  unavailable: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  icon: { width: 36, height: 36 },
});
