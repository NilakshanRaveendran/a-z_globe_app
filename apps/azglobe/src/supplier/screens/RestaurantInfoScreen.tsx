import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { dropPin } from '@app/location';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { Button, Screen, ScreenHeader, Skeleton, Text } from '@core/ui';
import type { DayHours, Merchant } from '@modules/food/types';
import type { RootStackParamList } from '@app/navigation/types';
import { SupplierField } from '../components/SupplierField';
import { getOwnedRestaurant, updateRestaurant, type Day } from '../services/restaurants';

/**
 * Restaurant Info — Figma 394:2730.
 *
 *   sections  eyebrow labels "Basic Information" / "Contact"
 *             (Urbanist 700 10/15 ls0.55 #9CA3AF)
 *   rows      label Urbanist 500 11/16.5 #6B7280 · value Urbanist 600 13/19.5
 *   hours     day pills — #1F2937 when open, #D1D5DB when closed
 *   prep      the same four chips as Add Restaurant step 4
 *
 * This is where Add Restaurant's promise is kept: "Map pin can be set after
 * creation from Restaurant Info". Setting it writes a real geohash, which is
 * what the "near you" range queries sort on.
 */
const DAYS: Array<{ day: Day; label: string }> = [
  { day: 'mon', label: 'Mon' },
  { day: 'tue', label: 'Tue' },
  { day: 'wed', label: 'Wed' },
  { day: 'thu', label: 'Thu' },
  { day: 'fri', label: 'Fri' },
  { day: 'sat', label: 'Sat' },
  { day: 'sun', label: 'Sun' },
];

const PREP_TIMES = [
  { label: '10–15 min', min: 10, max: 15 },
  { label: '20–30 min', min: 20, max: 30 },
  { label: '30–45 min', min: 30, max: 45 },
  { label: '45–60 min', min: 45, max: 60 },
];

export function RestaurantInfoScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierRestaurantInfo'>>();
  const { merchantId } = params;

  const [merchant, setMerchant] = useState<Merchant | null | 'missing'>(null);
  const [name, setName] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [prepIndex, setPrepIndex] = useState(1);
  const [hours, setHours] = useState<Record<Day, DayHours> | null>(null);
  const [geo, setGeo] = useState<Merchant['geo']>(undefined);

  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  // Tone travels with the text: colouring by string comparison made the
  // informational "Pin set… Save to keep it." render in error red.
  const [message, setMessageState] = useState<{ text: string; tone: 'info' | 'ok' | 'error' } | null>(null);
  const setMessage = (text: string | null, tone: 'info' | 'ok' | 'error' = 'error') =>
    setMessageState(text ? { text, tone } : null);

  const load = useCallback(async () => {
    const m = await getOwnedRestaurant(merchantId);
    if (!m) {
      setMerchant('missing');
      return;
    }
    setMerchant(m);
    setName(m.name);
    setCuisines(m.cuisines.join(' · '));
    setTagline(m.tagline);
    setAddress(m.address);
    setPhone(m.phone);
    setDeliveryFee(String(m.deliveryFee ?? 0));
    setHours(m.hours as Record<Day, DayHours>);
    setGeo(m.geo);
    const i = PREP_TIMES.findIndex((p) => p.min === m.prepTimeMin && p.max === m.prepTimeMax);
    setPrepIndex(i >= 0 ? i : 1);
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setPin = async () => {
    setPinning(true);
    setMessage(null);
    try {
      const result = await dropPin();
      if (!result.ok) {
        setMessage(
          result.reason === 'permission'
            ? 'Location permission is needed to drop the pin at your restaurant.'
            : 'Could not get a location fix. Step outside or near a window and try again.'
        );
        return;
      }
      setGeo(result.geo);
      setMessage('Pin set to your current location. Save to keep it.', 'info');
    } finally {
      setPinning(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const prep = PREP_TIMES[prepIndex] ?? PREP_TIMES[1]!;
      await updateRestaurant(merchantId, {
        name: name.trim(),
        tagline: tagline.trim(),
        cuisines: cuisines
          .split(/[·,]/)
          .map((c) => c.trim())
          .filter(Boolean),
        address: address.trim(),
        phone: phone.trim(),
        deliveryFee: Number(deliveryFee.replace(/[^\d]/g, '')) || 0,
        prepTimeMin: prep.min,
        prepTimeMax: prep.max,
        ...(hours ? { hours } : {}),
        ...(geo ? { geo } : {}),
      });
      setMessage('Saved.', 'ok');
    } catch {
      setMessage('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: Day) => {
    setHours((prev) => {
      if (!prev) return prev;
      const current = prev[day];
      return { ...prev, [day]: { ...current, closed: !current?.closed } };
    });
  };

  if (merchant === null) {
    return (
      <Screen>
        <ScreenHeader title="Restaurant Info" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Skeleton height={60} />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </View>
      </Screen>
    );
  }

  if (merchant === 'missing') {
    return (
      <Screen>
        <ScreenHeader title="Restaurant Info" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text variant="bodyLg" color={colors.textSecondary}>
            That restaurant is no longer available on your account.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Restaurant Info" subtitle={merchant.name} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="eyebrowSm" color={colors.textMuted}>
          Basic Information
        </Text>
        <SupplierField label="Restaurant Name" value={name} onChangeText={setName} />
        <SupplierField label="Cuisine / Category" value={cuisines} onChangeText={setCuisines} />
        <SupplierField
          label="Short Description"
          multiline
          value={tagline}
          onChangeText={setTagline}
        />

        <Text variant="eyebrowSm" color={colors.textMuted} style={styles.section}>
          Contact
        </Text>
        <SupplierField label="Address" value={address} onChangeText={setAddress} />

        <View style={styles.pinRow}>
          <View style={styles.pinText}>
            <Text variant="micro" color={colors.textSecondary}>
              Map pin
            </Text>
            <Text variant="label" color={geo ? colors.text : colors.textMuted}>
              {geo ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : 'Not set'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={pinning}
            onPress={() => void setPin()}
            style={styles.pinBtn}
          >
            <Text variant="captionBold" color={colors.palette.gray700}>
              {pinning ? 'Locating…' : 'Set Pin'}
            </Text>
          </Pressable>
        </View>

        <SupplierField
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <SupplierField
          label="Delivery Fee"
          value={deliveryFee}
          onChangeText={setDeliveryFee}
          keyboardType="number-pad"
        />

        <View style={styles.field}>
          <Text variant="eyebrowSm" color={colors.textMuted}>
            Average Preparation Time
          </Text>
          <View style={styles.chips}>
            {PREP_TIMES.map((p, i) => {
              const on = i === prepIndex;
              return (
                <Pressable
                  key={p.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPrepIndex(i)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text variant="bodySm" color={on ? colors.onPrimary : colors.textSecondary}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text variant="h5" color={colors.text} style={styles.section}>
          Opening Hours
        </Text>
        <Text variant="microRegular" color={colors.textMuted}>
          Tap a day to close it. Greyed days are closed.
        </Text>
        <View style={styles.chips}>
          {DAYS.map(({ day, label }) => {
            const closed = hours?.[day]?.closed === true;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: !closed }}
                onPress={() => toggleDay(day)}
                style={styles.dayPill}
              >
                <Text
                  variant="body"
                  color={closed ? colors.borderStrong : colors.text}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {message ? (
          <Text
            variant="bodySm"
            color={message.tone === 'ok' ? colors.success : message.tone === 'info' ? colors.textSecondary : colors.primary}
            style={styles.section}
          >
            {message.text}
          </Text>
        ) : null}

        <View style={styles.saveRow}>
          <Button label={saving ? 'Saving…' : 'Save Changes'} onPress={() => void save()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing[12],
    gap: spacing[5],
  },
  section: { marginTop: spacing[6] },
  field: { gap: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2.5] },
  chip: {
    paddingVertical: spacing[3],
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  dayPill: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinText: { gap: spacing[0.5] },
  pinBtn: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  saveRow: { marginTop: spacing[6] },
});
