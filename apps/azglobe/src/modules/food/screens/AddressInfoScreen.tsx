import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { BottomBar, Button, Icon, Screen, Text } from '@core/ui';
import { Field } from '@core/ui/Field';
import { colors, fontFamily, radius, SCREEN_PADDING, spacing, typography } from '@core/theme';
import { dropPin } from '@app/location';
import { MapPreview } from '../components/MapPreview';
import { useAddresses } from '../hooks/useAddresses';
import { addressSubtitle, removeAddress, saveAddress } from '../services/addresses';
import type { AddressLabel, BuildingType, DropoffOption, GeoPoint } from '../types';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

const DROPOFF: Array<{ key: DropoffOption; label: string; hint?: string }> = [
  { key: 'door', label: 'Meet at my door', hint: 'More options available' },
  { key: 'lobby', label: 'Leave at lobby' },
  { key: 'gate', label: 'Leave at gate' },
];

const LABELS: AddressLabel[] = ['Home', 'Work', 'Other'];

const BUILDING_NAMES: Record<BuildingType, string> = {
  house: 'House',
  apartment: 'Apartment',
  office: 'Office',
  hotel: 'Hotel',
  other: 'Other',
};

/**
 * Address info — Figma 400:4244.
 *
 *   header      36pt circular back · "Address info" 16/24 · "Remove" #EF4444
 *   map         180pt preview with the address chip
 *   card 1      Building Type picker + Apt / Business / Landmark fields
 *   card 2      Dropoff options as radios
 *   card 3      Instructions textarea + "Add photos" dashed row
 *   card 4      Address label chips
 *   footer      "Save and continue"
 *
 * Saves to `customers/{uid}/addresses` and makes the address the one checkout
 * delivers to. Figma reaches this screen from a places search that has already
 * resolved the street; that API needs billing the Spark plan does not have, so
 * the street and city are entered here, above the design's own card 1, and the
 * map pin comes from the device when the person is at the address.
 */
export function AddressInfoScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'AddressInfo'>>();
  const { uid, addresses, select, refresh } = useAddresses();
  const existing = params?.addressId ? addresses.find((a) => a.id === params.addressId) : undefined;

  const [line1, setLine1] = useState(params?.line1 ?? '');
  const [city, setCity] = useState('');
  const [geo, setGeo] = useState<GeoPoint | undefined>(undefined);
  const [buildingType, setBuildingType] = useState<BuildingType>('house');
  const [apt, setApt] = useState('');
  const [building, setBuilding] = useState('');
  const [landmark, setLandmark] = useState('');
  const [dropoff, setDropoff] = useState<DropoffOption>('door');
  const [instructions, setInstructions] = useState('');
  const [label, setLabel] = useState<AddressLabel>(params?.label ?? 'Home');

  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Editing: fill the form once the address arrives from the address book.
  useEffect(() => {
    if (!existing || loadedId === existing.id) return;
    setLoadedId(existing.id);
    setLine1(existing.line1);
    setCity(existing.city);
    setGeo(existing.geo);
    setBuildingType(existing.buildingType ?? 'house');
    setApt(existing.apt ?? '');
    setBuilding(existing.buildingName ?? '');
    setLandmark(existing.landmark ?? '');
    setDropoff(existing.dropoffOption ?? 'door');
    setInstructions(existing.instructions ?? '');
    setLabel(existing.label);
  }, [existing, loadedId]);

  // The Building Type screen hands its choice back through route params.
  useEffect(() => {
    if (params?.buildingType) setBuildingType(params.buildingType);
  }, [params?.buildingType]);

  const pin = async () => {
    setPinning(true);
    setNote(null);
    try {
      const result = await dropPin();
      if (result.ok) {
        setGeo(result.geo);
        setNote('Pinned to where you are now.');
      } else {
        setNote(
          result.reason === 'permission'
            ? 'Location permission is needed to pin the address. You can still save it without a pin.'
            : 'Could not get a location fix. You can still save the address without a pin.'
        );
      }
    } finally {
      setPinning(false);
    }
  };

  // "Explore nearby › Use my current location" opens this screen asking for a pin.
  useEffect(() => {
    if (params?.useLocation) void pin();
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSave = line1.trim().length >= 3 && !saving;

  const onSave = async () => {
    setSaving(true);
    setNote(null);
    try {
      const saved = await saveAddress(uid, {
        id: existing?.id,
        label,
        line1: line1.trim(),
        city: city.trim(),
        geo,
        buildingType,
        apt: apt.trim() || undefined,
        buildingName: building.trim() || undefined,
        landmark: landmark.trim() || undefined,
        dropoffOption: dropoff,
        instructions: instructions.trim() || undefined,
      });
      select(saved.id);
      await refresh();
      navigation.goBack();
    } catch {
      setNote('Could not save the address. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    if (!existing) {
      navigation.goBack();
      return;
    }
    await removeAddress(uid, existing.id).catch(() => undefined);
    select(null);
    await refresh();
    navigation.goBack();
  };

  const chip = line1.trim()
    ? `${label}, ${addressSubtitle({ line1: line1.trim(), city: city.trim() })}`
    : 'Add your delivery address';

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name="arrowLeft" size={18} color={colors.text} />
        </Pressable>
        <Text variant="h3" color={colors.text}>
          Address info
        </Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void onRemove()}>
          <Text variant="body" color="#EF4444" style={styles.remove}>
            {existing ? 'Remove' : 'Cancel'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <MapPreview label={chip} height={180} />

        <View style={styles.cards}>
          <View style={styles.card}>
            <Field
              label="Street address"
              placeholder="e.g. 574 Hospital Rd"
              value={line1}
              onChangeText={setLine1}
            />
            <Field label="City" placeholder="e.g. Jaffna" value={city} onChangeText={setCity} />
            <Pressable
              accessibilityRole="button"
              onPress={() => void pin()}
              disabled={pinning}
              style={({ pressed }) => [styles.pinRow, pressed && styles.pressed]}
            >
              <Icon name="navigation" size={16} color={geo ? colors.success : colors.textSecondary} />
              <Text variant="body" color={geo ? colors.textStrong : colors.textSecondary} style={styles.flex}>
                {pinning
                  ? 'Finding you…'
                  : geo
                    ? `Pinned · ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`
                    : 'Pin my current location (optional)'}
              </Text>
            </Pressable>
            {note ? (
              <Text variant="bodySm" color={colors.textSecondary}>
                {note}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Field
              label="Building Type"
              onPress={() =>
                navigation.navigate('BuildingType', { addressId: existing?.id, current: buildingType })
              }
              displayValue={BUILDING_NAMES[buildingType]}
            />
            <Field
              label="Apt / Flat / Floor"
              placeholder="e.g. Apt 4B, Floor 3"
              value={apt}
              onChangeText={setApt}
            />
            <Field
              label="Business / Building name"
              placeholder="Optional"
              value={building}
              onChangeText={setBuilding}
            />
            <Field
              label="Nearby landmark"
              placeholder="e.g. Near city hospital"
              value={landmark}
              onChangeText={setLandmark}
            />
          </View>

          <View style={styles.card}>
            <Text variant="h4" color={colors.textStrong}>
              Dropoff options
            </Text>
            {DROPOFF.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: dropoff === option.key }}
                onPress={() => setDropoff(option.key)}
                style={styles.radioRow}
              >
                <View style={[styles.radio, dropoff === option.key && styles.radioOn]}>
                  {dropoff === option.key ? <View style={styles.radioDot} /> : null}
                </View>
                <Text variant="h5" color={colors.textStrong}>
                  {option.label}
                </Text>
                {option.hint ? (
                  <Text variant="bodySm" color={colors.textMuted}>
                    · {option.hint}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            <Text variant="label" color={colors.palette.gray700}>
              Instructions for delivery person
            </Text>
            <TextInput
              style={styles.textarea}
              placeholder="e.g. Ring the bell twice, leave at door if no answer…"
              placeholderTextColor="rgba(31,41,55,0.5)"
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {/* Photo upload needs Cloud Storage, which is not on the Spark plan. */}
            <View style={styles.addPhotos}>
              <Icon name="image" size={16} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted}>
                Add photos · coming soon
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text variant="h4" color={colors.textStrong}>
              Address label
            </Text>
            <View style={styles.labelRow}>
              {LABELS.map((l) => (
                <Pressable
                  key={l}
                  accessibilityRole="button"
                  accessibilityState={{ selected: label === l }}
                  onPress={() => setLabel(l)}
                  style={[styles.labelChip, label === l ? styles.labelChipOn : styles.labelChipOff]}
                >
                  <Text variant="body" color={label === l ? colors.primary : colors.textStrong}>
                    {l}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomBar>
        <Button
          label="Save and continue"
          onPress={() => void onSave()}
          loading={saving}
          disabled={!canSave}
        />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  remove: { fontFamily: fontFamily[600] },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },

  content: { paddingBottom: spacing[8] },
  cards: { padding: spacing[5], gap: spacing[8] },
  card: {
    gap: spacing[4],
    padding: spacing[6],
    borderRadius: radius['3xl'],
    borderWidth: 0.52,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
  },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: spacing[2] },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  textarea: {
    ...typography.body,
    color: colors.text,
    minHeight: 96,
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 0.52,
    borderColor: colors.border,
  },
  addPhotos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },

  labelRow: { flexDirection: 'row', gap: spacing[3] },
  labelChip: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  labelChipOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  labelChipOff: { backgroundColor: colors.surface, borderColor: colors.border },
});
