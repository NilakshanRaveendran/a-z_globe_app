import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Screen, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { modules } from '@modules/registry';
import type { ModuleDescriptor } from '@modules/types';
import { ServiceCard } from '@app/components/ServiceCard';
import { useSession } from '@app/providers/SessionProvider';
import type { RootStackParamList } from '@app/navigation/types';

/**
 * Home (Figma 324:1708 — and 324:2157 with a live order).
 *
 * Layout, top to bottom:
 *   Header    location row (pad 10/16) + greeting block (pad 12/16/16/16,
 *             1px bottom border #E5E7EB)
 *   [live order card, when one is active — see 324:2157]
 *   Services  "Our Services" + a 3-column grid of module tiles, gap 12
 *   Module-contributed sections (Popular Dishes, Popular Near You)
 *
 * The services grid and the sections below it both come from the module
 * registry, so this screen needs no change when a new A-Z module ships.
 */
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, location, greeting } = useSession();

  const openModule = (m: ModuleDescriptor) => {
    if (m.status !== 'live' || !m.route) {
      navigation.navigate('ComingSoon', { title: m.title });
      return;
    }
    navigation.navigate(m.route as 'Food', undefined as never);
  };

  const allSections = modules.flatMap((m) => m.homeSections ?? []);
  const sectionsFor = (slot: 'above-services' | 'below-services') =>
    allSections.filter((s) => s.slot === slot).sort((a, b) => a.order - b.order);

  // Figma lays the services out three per row.
  const tiles = modules.filter((m) => m.sortOrder >= 0).sort((a, b) => a.sortOrder - b.sortOrder);
  const rows: ModuleDescriptor[][] = [];
  for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        // The tab bar already provides the bottom inset.
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable style={styles.locationButton} hitSlop={6}>
              <Icon name="mapPin" size={14} color={colors.primary} />
              <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1}>
                {location}
              </Text>
              <Icon name="chevronRight" size={13} color={colors.textSecondary} />
            </Pressable>

            <View style={styles.headerActions}>
              <Pressable style={styles.notifButton} hitSlop={6}>
                <Icon name="bell" size={20} color={colors.text} />
                <View style={styles.notifDot} />
              </Pressable>
              <View style={styles.avatar}>
                <Text variant="h2" color={colors.onPrimary} style={styles.avatarInitial}>
                  {user.initial}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.greetingBlock}>
            <Text variant="h1" color={colors.text} style={styles.greeting}>
              {greeting}, {user.firstName} 👋
            </Text>
            <Text variant="bodyLg" color={colors.textSecondary}>
              What service do you need today?
            </Text>
          </View>
        </View>

        {sectionsFor('above-services').map(({ key, Component }) => (
          <Component key={key} />
        ))}

        <View style={styles.services}>
          <Text variant="h3" color={colors.text}>
            Our Services
          </Text>
          {rows.map((row, i) => (
            <View key={i} style={styles.serviceRow}>
              {row.map((m) => (
                <ServiceCard key={m.id} module={m} onPress={() => openModule(m)} />
              ))}
              {/* Keeps a short final row aligned to the left. */}
              {Array.from({ length: 3 - row.length }).map((_, k) => (
                <View key={`spacer-${k}`} style={styles.serviceSpacer} />
              ))}
            </View>
          ))}
        </View>

        {sectionsFor('below-services').map(({ key, Component }) => (
          <Component key={key} />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing[8] },

  header: { backgroundColor: colors.surface },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[3.5],
  },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5], flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FB2C36',
    borderWidth: 0.54,
    borderColor: colors.surface,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarInitial: { lineHeight: 28 },
  greetingBlock: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Figma's greeting is 24/36 — larger than the h1 preset used elsewhere.
  greeting: { fontSize: 24, lineHeight: 36 },

  services: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[8],
    gap: spacing[4],
  },
  serviceRow: { flexDirection: 'row', gap: spacing[4] },
  serviceSpacer: { flex: 1 },
});
