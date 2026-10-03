import { useState } from 'react';
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
// The header's delivery location and bell are the Food module's today — the
// only module that delivers anywhere. They move behind the registry when a
// second one does.
import { AddressSearchSheet } from '@modules/food/components/AddressSearchSheet';
import { OrdersBell } from '@modules/food/components/OrdersBell';
import { useAddresses } from '@modules/food/hooks/useAddresses';

/**
 * Home (Figma 324:1708 — and 324:2157 with a live order).
 *
 * Layout, top to bottom:
 *   Header    location row (pad 10/16) + greeting block (pad 12/16/16/16,
 *             1px bottom border #E5E7EB)
 *   [live order card, when one is active — see 324:2157]
 *   Services  "Our Services" + a 3-column grid of 106×90 module tiles
 *             (324:2206) — 22 between columns, 12 between rows
 *   Module-contributed sections (Popular Dishes, Popular Near You)
 *
 * The services grid and the sections below it both come from the module
 * registry, so this screen needs no change when a new A-Z module ships.
 *
 * Header controls: the location row shows the delivery address the customer
 * picked and opens the Addresses sheet (269:1496) to change it; the bell opens
 * the live order (red dot) or My Orders; the avatar opens Profile.
 */
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, location, greeting } = useSession();
  const { addresses, selected, select } = useAddresses();
  const [addressOpen, setAddressOpen] = useState(false);
  // Figma writes the place as "Orr's Hill, Trincomalee" — street, then town.
  const deliverTo = selected ? [selected.line1, selected.city].filter(Boolean).join(', ') : location;

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

  // Figma (324:2206) lays the services out three per row.
  const perRow = 3;
  const tiles = modules.filter((m) => m.sortOrder >= 0).sort((a, b) => a.sortOrder - b.sortOrder);
  const rows: ModuleDescriptor[][] = [];
  for (let i = 0; i < tiles.length; i += perRow) rows.push(tiles.slice(i, i + perRow));

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delivering to ${deliverTo}. Change address`}
              onPress={() => setAddressOpen(true)}
              style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
              hitSlop={6}
            >
              <Icon name="mapPin" size={14} color={colors.primary} />
              <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1} style={styles.locationText}>
                {deliverTo}
              </Text>
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <Icon name="chevronRight" size={13} color={colors.textSecondary} />
              </View>
            </Pressable>

            <View style={styles.headerActions}>
              <OrdersBell />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile"
                onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}
                style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              >
                <Text variant="h2" color={colors.onPrimary} style={styles.avatarInitial}>
                  {user.initial}
                </Text>
              </Pressable>
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
              {Array.from({ length: perRow - row.length }).map((_, k) => (
                <View key={`spacer-${k}`} style={styles.serviceSpacer} />
              ))}
            </View>
          ))}
        </View>

        {sectionsFor('below-services').map(({ key, Component }) => (
          <Component key={key} />
        ))}
      </ScrollView>

      <AddressSearchSheet
        visible={addressOpen}
        addresses={addresses}
        selectedId={selected?.id}
        onSelect={(next) => {
          select(next.id);
          setAddressOpen(false);
        }}
        onEdit={(next) => {
          setAddressOpen(false);
          navigation.navigate('Food', { screen: 'AddressInfo', params: { addressId: next.id } });
        }}
        onAdd={(intent) => {
          setAddressOpen(false);
          navigation.navigate('Food', { screen: 'AddressInfo', params: intent });
        }}
        onClose={() => setAddressOpen(false)}
      />
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
    // 12 above the buttons, as on every header.
    paddingVertical: spacing[4],
  },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5], flexShrink: 1 },
  locationText: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
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
  // A readable greeting that can wrap on narrow screens.
  greeting: { fontSize: 28, lineHeight: 36 },

  services: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[8],
    gap: spacing[4],
  },
  // Figma: 21.7 between columns (106-wide tiles across 361).
  serviceRow: { flexDirection: 'row', gap: 12 },
  serviceSpacer: { flex: 1 },
});
