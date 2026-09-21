import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from '@core/ui';
import { SearchBar } from '@core/ui/SearchBar';
import { Sheet } from '@core/ui/Sheet';
import { colors, radius, shadows, spacing } from '@core/theme';
import { addressSubtitle, addressTitle } from '../services/addresses';
import type { Address, AddressLabel } from '../types';

/**
 * "Addresses" sheet — Figma 269:1496.
 *
 *   header    "Addresses" 16/24 with a close button
 *   search    45pt pill · #F3F4F6
 *   shortcuts Home / Set work / Add label — 50pt cards, r10, 1px border, soft shadow
 *   nearby    "Explore nearby" heading then rows with a 36pt circular icon well
 *   saved     "Saved addresses" on a tinted band; the current one is highlighted
 *             and every row has an edit pencil
 *
 * Driven by the customer's real address book. Figma's search assumes a
 * places API, which needs billing the Spark plan does not have, so typing
 * filters the saved addresses and offers to add what was typed as a new one;
 * the "Explore nearby" row starts a new address pinned at the device's
 * location instead of listing invented nearby streets.
 */
export type NewAddressIntent = { label?: AddressLabel; line1?: string; useLocation?: boolean };

export function AddressSearchSheet({
  visible,
  addresses,
  selectedId,
  onSelect,
  onEdit,
  onAdd,
  onClose,
}: {
  visible: boolean;
  addresses: Address[];
  selectedId?: string;
  onSelect: (address: Address) => void;
  onEdit: (address: Address) => void;
  onAdd: (intent: NewAddressIntent) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = q
    ? addresses.filter((a) => addressSubtitle(a).toLowerCase().includes(q) || a.label.toLowerCase().includes(q))
    : addresses;

  const home = addresses.find((a) => a.label === 'Home');
  const work = addresses.find((a) => a.label === 'Work');

  return (
    <Sheet visible={visible} onClose={onClose} title="Addresses">
      <View style={styles.searchWrap}>
        <SearchBar placeholder="Search for an address" value={query} onChangeText={setQuery} />
      </View>

      <View style={styles.shortcuts}>
        <Shortcut
          icon="mapPin"
          title="Home"
          subtitle={home ? addressSubtitle(home) : 'Set home'}
          onPress={() => (home ? onSelect(home) : onAdd({ label: 'Home' }))}
        />
        <Shortcut
          icon="store"
          title={work ? 'Work' : 'Set work'}
          subtitle={work ? addressSubtitle(work) : undefined}
          onPress={() => (work ? onSelect(work) : onAdd({ label: 'Work' }))}
        />
        <Shortcut icon="plus" title="Add label" onPress={() => onAdd({ label: 'Other' })} />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {q ? (
          <Pressable style={styles.nearbyRow} onPress={() => onAdd({ line1: query.trim() })}>
            <View style={styles.nearbyWell}>
              <Icon name="plus" size={16} color={colors.text} />
            </View>
            <View style={styles.flex}>
              <Text variant="h5" color={colors.textStrong} numberOfLines={1}>
                Add “{query.trim()}”
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                Save it as a new delivery address
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <Text variant="h3" color={colors.text} style={styles.sectionHeading}>
              Explore nearby
            </Text>
            <Pressable style={styles.nearbyRow} onPress={() => onAdd({ useLocation: true })}>
              <View style={styles.nearbyWell}>
                <Icon name="navigation" size={16} color={colors.text} />
              </View>
              <View style={styles.flex}>
                <Text variant="h5" color={colors.textStrong}>
                  Use my current location
                </Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  Pin where you are now, then add the street
                </Text>
              </View>
            </Pressable>
          </>
        )}

        <View style={styles.savedBand}>
          <Text variant="h3" color={colors.text}>
            Saved addresses
          </Text>
        </View>

        {matches.map((address) => {
          const current = address.id === selectedId;
          return (
            <Pressable
              key={address.id}
              onPress={() => onSelect(address)}
              style={[styles.savedRow, current && styles.savedRowCurrent]}
            >
              <Icon name="mapPin" size={20} color={colors.text} />
              <View style={styles.flex}>
                <Text variant="h5" color={colors.textStrong}>
                  {addressTitle(address)}
                </Text>
                <Text variant="bodySm" color={colors.textSecondary} numberOfLines={1}>
                  {addressSubtitle(address)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${addressTitle(address)}`}
                onPress={() => onEdit(address)}
                hitSlop={8}
              >
                <Icon name="pencil" size={16} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          );
        })}

        {!matches.length ? (
          <Text variant="bodyLg" color={colors.textMuted} align="center" style={styles.empty}>
            {q ? `No saved address matches “${query}”.` : 'No saved addresses yet.'}
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function Shortcut({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: 'mapPin' | 'store' | 'plus';
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
      <Icon name={icon} size={18} color={colors.palette.gray700} />
      <View style={styles.flex}>
        <Text variant="label" color={colors.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[4] },
  shortcuts: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[6], paddingBottom: spacing[6] },
  shortcut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 0.52,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },

  list: { maxHeight: 380 },
  sectionHeading: { paddingHorizontal: spacing[6], paddingBottom: spacing[3] },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  nearbyWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },

  savedBand: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    marginTop: spacing[3],
    backgroundColor: colors.surfaceSunken,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  savedRowCurrent: { backgroundColor: colors.surfaceSunken },

  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  empty: { paddingVertical: spacing[9] },
});
