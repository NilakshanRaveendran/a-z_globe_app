import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { geohashForLocation } from 'geofire-common';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, usePreventRemove, useRoute, type RouteProp } from '@react-navigation/native';
import { dropPin } from '@app/location';
import { colors, fontFamily, gradients, radius, SCREEN_PADDING, shadows, spacing, typography } from '@core/theme';
import { Button, Icon, Screen, Skeleton, Text, showToast } from '@core/ui';
import { Alert } from '@core/ui/alert';
import type { DayHours, Merchant, MerchantFeature } from '@modules/food/types';
import type { RootStackParamList } from '@app/navigation/types';
import { SupplierPageHeader } from '../components/SupplierPageHeader';
import { SupplierField, type SupplierFieldProps } from '../components/SupplierField';
import { ActionMenu, measureAnchor, type MenuAnchor } from '../components/ActionMenu';
import { getOwnedRestaurant, updateRestaurant, type Day, type RestaurantEdits } from '../services/restaurants';
import {
  dayHoursError,
  DELIVERY_TERMS_MESSAGES,
  deliveryTermsErrors,
  formatDeliveryFee,
  hoursNote,
  normaliseTime,
  parseDeliveryFee,
  parseKm,
  parseOptionalAmount,
  RESTAURANT_FIELD_MESSAGES,
  restaurantEditErrors,
  type DeliveryTermsField,
  type RestaurantField,
} from '../services/restaurantValidation';
import { feeSchedule, formatKm } from '@modules/food/services/deliveryPricing';
import { formatMoney } from '@core/utils/currency';
import { initials } from '@core/utils/text';

/**
 * Restaurant Information — Figma 394:2730.
 *
 *   header   SupplierPageHeader, title only, Urbanist 700 22/33 with 12 above
 *   cover    h130 · 160° #D42B2B → #FF8A65 · "Change Cover" pill (rgba(0,0,0,.25),
 *            r12, pad 7/12, 15pt camera, 600 12/18 white), centred
 *   logo     52pt r16 #D42B2B tile · 2.55 white border · 700 22/33 initial,
 *            16 from the left, overlapping the cover's bottom edge by 22 ·
 *            20pt #D42B2B edit badge, 1.53 white ring, 9pt white pencil, at
 *            its bottom-right corner
 *   cards    #FFFFFF · 0.51 #E5E7EB · r16 · pad 16 · 0 1 1.5 6% · 16 apart;
 *            heading = tracked eyebrow 700 10/15 ls0.55 #9CA3AF, 10 above the body
 *   fields   label 500 11/16.5 #6B7280, 5 above a h42.5 r12 box (pad 11/14,
 *            600 13/19.5; the description is 400 13/19.5, h81.5)
 *   map      h100 · r14 · 163° #E8F4F0 → #DCEEF8 · #C8DDE8 grid, #B5CCD8 roads ·
 *            28x36 pin over a white-80% address pill · "⊕ Set Pin" white r8
 *            pad 5/8 600 10/15 #374151, 8 from the right and bottom
 *   hours    r20 · pad 18 · 32pt #FFF0F0 r10 clock well + 700 14/21 title ·
 *            day rows #FAFAFA r12 pad 10/12, 2 apart: 600 13/19.5 day (#D1D5DB
 *            when closed) · "Closed" pill (#F3F4F6, 0.51 #E5E7EB, 500 11/16.5
 *            #9CA3AF) or two 68x25.5 r8 time boxes (600 11/16.5) with "–" ·
 *            40x22 toggle (17pt knob)
 *   orders   prep chips h33 · pad 7/12 · r10 · 600 12/18 · 8 apart · Delivery
 *            Available 600 13/19.5 + 400 11/16.5 with a 44x24 toggle · fee field
 *   save     sticky: #FFFFFF · 0.51 #E5E7EB top rule · pad 12.5/16 · h50 r14
 *            #D42B2B · 14pt check + 700 14/21 "Save Changes"
 *
 * Only what persists works. There is no image upload yet (no picker, and
 * Storage needs the Blaze plan), so "Change Cover" is drawn dimmed and says
 * "coming soon" when tapped; the logo IS the name's initial, so its edit badge
 * takes the owner to the name field.
 *
 * Saving: each field names its own problem under it (hours per day), Save
 * scrolls to the first one, "All changes saved" disappears with the next edit,
 * and leaving with unsaved edits asks first.
 *
 * This is where Add Restaurant's promise is kept: "Map pin can be set after
 * creation from Restaurant Information settings". Set Pin offers the phone's
 * current location or — on iOS and Android, where expo-location can geocode —
 * the typed address; its messages sit under the map. Either writes a real
 * geohash, which is what the "near you" range queries sort on.
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

const DAY_LABELS = Object.fromEntries(DAYS.map(({ day, label }) => [day, label])) as Record<Day, string>;

const PREP_TIMES = [
  { label: '10–15 min', min: 10, max: 15 },
  { label: '20–30 min', min: 20, max: 30 },
  { label: '30–45 min', min: 30, max: 45 },
  { label: '45–60 min', min: 45, max: 60 },
];

/** expo-location geocodes on iOS and Android only (SDK 57); the web has no geocoder. */
const CAN_GEOCODE = Platform.OS === 'ios' || Platform.OS === 'android';

type Hours = Record<Day, DayHours>;
type Tone = 'info' | 'ok' | 'error';
type Note = { text: string; tone: Tone };
type Section = 'basic' | 'location' | 'contact' | 'hours' | 'orders';

/** Which card holds each field — Save scrolls to the first bad one. */
const FIELD_SECTIONS: Array<[RestaurantField, Section]> = [
  ['name', 'basic'],
  ['cuisines', 'basic'],
  ['tagline', 'basic'],
  ['address', 'location'],
  ['phone', 'contact'],
  ['openTime', 'hours'],
  ['closeTime', 'hours'],
  ['prepTime', 'orders'],
  ['deliveryFee', 'orders'],
];

/** Every day present, so a document missing one can't crash the rows. */
function normaliseHours(hours: Partial<Hours> | undefined): Hours {
  return Object.fromEntries(
    DAYS.map(({ day }) => [day, hours?.[day] ?? { open: '', close: '', closed: true }])
  ) as Hours;
}

type Form = {
  name: string;
  cuisines: string;
  tagline: string;
  address: string;
  phone: string;
  deliveryAvailable: boolean;
  deliveryFee: string;
  /** Delivery terms — Merchant.deliveryRules and freeDeliveryOver, as typed. */
  pricing: 'flat' | 'distance';
  freeKm: string;
  perKm: string;
  limitArea: boolean;
  maxKm: string;
  freeOver: string;
  prepIndex: number;
  hours: Hours;
  geo: Merchant['geo'];
};

/** The form a saved restaurant opens with. */
function formFrom(m: Merchant): Form {
  // Older and seeded restaurants charge a fee without the homeDelivery
  // feature; a fee means they deliver, so an unrelated save must not zero it.
  const delivers = (m.features ?? []).includes('homeDelivery') || (m.deliveryFee ?? 0) > 0;
  return {
    name: m.name,
    cuisines: m.cuisines.join(' · '),
    tagline: m.tagline,
    address: m.address,
    phone: m.phone,
    deliveryAvailable: delivers,
    // "Rs. 150", as Figma writes it; blank when delivery is off and there is
    // no fee to show, so turning delivery on asks for one.
    deliveryFee: delivers || m.deliveryFee ? formatDeliveryFee(m.deliveryFee ?? 0) : '',
    // A restaurant without terms opens on the flat fee, with sensible
    // distance defaults ready if the owner switches (free 1 km, Rs. 50/km, 5 km).
    pricing: m.deliveryRules?.pricing ?? 'flat',
    // Two decimals, as the field accepts — rounding to one would quietly
    // change a saved 2.25 km on the next unrelated save.
    freeKm: kmField(m.deliveryRules?.pricing === 'distance' ? m.deliveryRules.freeKm : 1),
    perKm: formatDeliveryFee(m.deliveryRules?.pricing === 'distance' ? m.deliveryRules.perKm : 50),
    limitArea: (m.deliveryRules?.maxKm ?? 0) > 0,
    maxKm: kmField((m.deliveryRules?.maxKm ?? 0) > 0 ? m.deliveryRules!.maxKm : 5),
    freeOver: m.freeDeliveryOver ? formatDeliveryFee(m.freeDeliveryOver) : '',
    prepIndex: PREP_TIMES.findIndex((p) => p.min === m.prepTimeMin && p.max === m.prepTimeMax),
    hours: normaliseHours(m.hours),
    geo: m.geo,
  };
}

/** A distance as the form shows it: up to two decimals, no trailing zeros. */
function kmField(km: number): string {
  return String(Math.round(km * 100) / 100);
}

/** A stable fingerprint of the form, to tell edited from saved. */
function fingerprint(f: Form): string {
  return JSON.stringify([
    f.name, f.cuisines, f.tagline, f.address, f.phone, f.deliveryAvailable, f.deliveryFee, f.prepIndex,
    f.pricing, f.freeKm, f.perKm, f.limitArea, f.maxKm, f.freeOver,
    DAYS.map(({ day }) => [f.hours[day].open, f.hours[day].close, !!f.hours[day].closed]),
    f.geo ? [f.geo.lat, f.geo.lng] : null,
  ]);
}

export function RestaurantInfoScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierRestaurantInfo'>>();
  const { merchantId } = params;

  const [load, setLoad] = useState<'loading' | 'error' | 'missing' | 'ready'>('loading');
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [name, setName] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [pricing, setPricing] = useState<'flat' | 'distance'>('flat');
  const [freeKm, setFreeKm] = useState('');
  const [perKm, setPerKm] = useState('');
  const [limitArea, setLimitArea] = useState(false);
  const [maxKm, setMaxKm] = useState('');
  const [freeOver, setFreeOver] = useState('');
  const [prepIndex, setPrepIndex] = useState(-1);
  const [hours, setHours] = useState<Hours>(normaliseHours(undefined));
  const [geo, setGeo] = useState<Merchant['geo']>(undefined);
  // The fingerprint of what is saved; the form is dirty when it differs.
  const [saved, setSaved] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [pinMenu, setPinMenu] = useState<MenuAnchor | null>(null);
  // Field errors show once Save has been tried, then track the edits live.
  const [attempted, setAttempted] = useState(false);
  // The save bar's line ("All changes saved", "Could not save") and the
  // map's own line (Set Pin), each carrying its tone.
  const [message, setMessageState] = useState<Note | null>(null);
  const [pinNote, setPinNoteState] = useState<Note | null>(null);
  const setMessage = (text: string | null, tone: Tone = 'error') => setMessageState(text ? { text, tone } : null);
  const setPinNote = (text: string | null, tone: Tone = 'error') => setPinNoteState(text ? { text, tone } : null);

  const scroll = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<Section, number>>>({});
  const nameInput = useRef<TextInput>(null);
  const setPinButton = useRef<View>(null);

  const applyForm = (f: Form) => {
    setName(f.name);
    setCuisines(f.cuisines);
    setTagline(f.tagline);
    setAddress(f.address);
    setPhone(f.phone);
    setDeliveryAvailable(f.deliveryAvailable);
    setDeliveryFee(f.deliveryFee);
    setPricing(f.pricing);
    setFreeKm(f.freeKm);
    setPerKm(f.perKm);
    setLimitArea(f.limitArea);
    setMaxKm(f.maxKm);
    setFreeOver(f.freeOver);
    setPrepIndex(f.prepIndex);
    setHours(f.hours);
    setGeo(f.geo);
    setSaved(fingerprint(f));
  };

  const loadRestaurant = useCallback(async () => {
    setLoad('loading');
    try {
      const m = await getOwnedRestaurant(merchantId);
      if (!m) {
        setLoad('missing');
        return;
      }
      setMerchant(m);
      applyForm(formFrom(m));
      setLoad('ready');
    } catch {
      setLoad('error');
    }
    // applyForm only calls state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  useEffect(() => {
    void loadRestaurant();
  }, [loadRestaurant]);

  const form: Form = {
    name, cuisines, tagline, address, phone, deliveryAvailable, deliveryFee,
    pricing, freeKm, perKm, limitArea, maxKm, freeOver, prepIndex, hours, geo,
  };
  const dirty = load === 'ready' && saved !== null && fingerprint(form) !== saved;

  // Back, the Android back button and a swipe all stop here while edits are
  // unsaved. Saving first is the owner's call.
  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert('Discard your changes?', 'You have edits on this page that aren’t saved yet.', [
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      { text: 'Keep editing', style: 'cancel' },
    ]);
  });

  const cuisineList = cuisines.split(/[·,]/).map((c) => c.trim()).filter(Boolean);
  const prep = PREP_TIMES[prepIndex];
  // The per-km base fee is optional: left blank, it is Rs. 0.
  const fee = !deliveryAvailable
    ? 0
    : pricing === 'distance' && !deliveryFee.trim()
      ? 0
      : parseDeliveryFee(deliveryFee);
  const check = restaurantEditErrors(
    {
      name,
      cuisines: cuisineList,
      tagline,
      address,
      phone,
      // A restaurant whose saved range isn't one of the four chips keeps it
      // until the owner picks a chip — saving must not silently change it.
      prepTimeMin: prep?.min ?? merchant?.prepTimeMin ?? NaN,
      prepTimeMax: prep?.max ?? merchant?.prepTimeMax ?? NaN,
      deliveryAvailable,
      deliveryFee: fee,
    },
    hours,
    DAY_LABELS
  );
  const terms = {
    deliveryAvailable,
    pricing,
    freeKm: parseKm(freeKm),
    perKm: parseDeliveryFee(perKm),
    limitArea,
    maxKm: parseKm(maxKm),
    freeOver: parseOptionalAmount(freeOver),
    hasPin: !!geo,
  };
  const termsInvalid = deliveryTermsErrors(terms);
  const termsError = (field: DeliveryTermsField) =>
    attempted && termsInvalid.has(field) ? DELIVERY_TERMS_MESSAGES[field] : null;
  // Everything that stops the save, in page order.
  const problems = [...check.messages, ...[...termsInvalid].map((f) => DELIVERY_TERMS_MESSAGES[f])];
  const flag = (field: RestaurantField) => attempted && check.fields.has(field);
  // Hours are judged per day below, not as one opening/closing pair.
  const fieldError = (field: RestaurantField) => (flag(field) ? RESTAURANT_FIELD_MESSAGES[field] : null);
  const dayInvalid = (day: Day) => attempted && check.days.includes(day);

  const trackSection = (section: Section) => (e: LayoutChangeEvent) => {
    sectionY.current[section] = e.nativeEvent.layout.y;
  };

  const scrollToFirstProblem = () => {
    const section =
      FIELD_SECTIONS.find(([field]) => check.fields.has(field))?.[1] ??
      (termsInvalid.has('deliveryPin') ? 'location' : termsInvalid.size ? 'orders' : undefined);
    const y = section ? sectionY.current[section] : undefined;
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - spacing[4]), animated: true });
  };

  const pinFromLocation = async () => {
    setPinning(true);
    setPinNote(null);
    try {
      const result = await dropPin();
      if (!result.ok) {
        setPinNote(
          result.reason === 'permission'
            ? CAN_GEOCODE
              ? 'Location permission is needed to use where you are. Allow it in Settings, or find the typed address instead.'
              : 'Location permission is needed to drop the pin where you are. Allow location for this site, or set the pin from the A-Z Globe phone app, which can also find the typed address.'
            : 'Could not get a location fix. Step outside or near a window and try again.'
        );
        return;
      }
      setGeo(result.geo);
      setPinNote('Pin set to your current location. Save to keep it.', 'info');
    } catch {
      setPinNote('Could not get a location fix. Step outside or near a window and try again.');
    } finally {
      setPinning(false);
    }
  };

  const pinFromAddress = async () => {
    const query = address.trim();
    if (!query) {
      setPinNote('Enter the address first, then find it on the map.');
      return;
    }
    setPinning(true);
    setPinNote(null);
    try {
      // Android's geocoder needs the location permission (expo-location docs).
      if (Platform.OS === 'android') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPinNote('Location permission is needed to look up the address on this phone.');
          return;
        }
      }
      const [hit] = await Location.geocodeAsync(query);
      if (!hit) {
        setPinNote(`Couldn’t find “${query}” on the map. Add the town or city, or use your current location.`);
        return;
      }
      const { latitude: lat, longitude: lng } = hit;
      setGeo({ lat, lng, geohash: geohashForLocation([lat, lng]) });
      setPinNote('Pin set from the address. Check it, then Save to keep it.', 'info');
    } catch {
      setPinNote('Could not look up the address. Check your connection and try again.');
    } finally {
      setPinning(false);
    }
  };

  const save = async () => {
    if (saving || !merchant) return;
    setAttempted(true);
    if (problems.length) {
      setMessage(null);
      scrollToFirstProblem();
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const features: MerchantFeature[] = [
        ...(merchant.features ?? []).filter((f) => f !== 'homeDelivery'),
        ...(deliveryAvailable ? (['homeDelivery'] as const) : []),
      ];
      // "7am" is stored as "7:00 AM", the form every reader expects.
      const savedHours = Object.fromEntries(
        DAYS.map(({ day }) => {
          const h = hours[day];
          const open = (h.open ?? '').trim();
          const close = (h.close ?? '').trim();
          return [day, { ...h, open: normaliseTime(open) ?? open, close: normaliseTime(close) ?? close }];
        })
      ) as Hours;
      const edits: RestaurantEdits = {
        name: name.trim(),
        tagline: tagline.trim(),
        cuisines: cuisineList,
        address: address.trim(),
        phone: phone.trim(),
        // Same rule as Add Restaurant: no delivery, no delivery fee.
        deliveryFee: deliveryAvailable ? fee : 0,
        // Only what applies is kept: distance terms, an area limit, or neither.
        deliveryRules:
          deliveryAvailable && (pricing === 'distance' || limitArea)
            ? {
                pricing,
                freeKm: pricing === 'distance' ? terms.freeKm : 0,
                perKm: pricing === 'distance' ? terms.perKm : 0,
                maxKm: limitArea ? terms.maxKm : 0,
              }
            : null,
        freeDeliveryOver: deliveryAvailable ? terms.freeOver : null,
        prepTimeMin: prep?.min ?? merchant.prepTimeMin,
        prepTimeMax: prep?.max ?? merchant.prepTimeMax,
        features,
        hours: savedHours,
        ...(geo ? { geo } : {}),
      };
      await updateRestaurant(merchantId, edits);
      const next = { ...merchant, ...edits };
      setMerchant(next);
      applyForm(formFrom(next));
      setAttempted(false);
      setPinNote(null);
      // Confirmed in the save bar rather than a toast, which would sit over
      // the sticky Save button.
      setMessage('All changes saved.', 'ok');
    } catch {
      setMessage('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day: Day, patch: Partial<DayHours>) =>
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  /** "7am" → "7:00 AM" as the box loses focus; unreadable text stays for its error. */
  const tidyTime = (day: Day, which: 'open' | 'close') =>
    setHours((prev) => {
      const value = prev[day][which] ?? '';
      const tidy = normaliseTime(value);
      return tidy && tidy !== value ? { ...prev, [day]: { ...prev[day], [which]: tidy } } : prev;
    });

  const toggleDay = (day: Day) =>
    setHours((prev) => {
      const current = prev[day];
      if (!current.closed) return { ...prev, [day]: { ...current, closed: true } };
      // Re-opening a day with no usable times borrows another open day's.
      const usable = (h: DayHours) => normaliseTime(h.open) !== null && normaliseTime(h.close) !== null;
      const donor = DAYS.map(({ day: d }) => prev[d]).find((h) => !h.closed && usable(h));
      const times = usable(current)
        ? { open: current.open, close: current.close }
        : { open: donor?.open ?? '', close: donor?.close ?? '' };
      return { ...prev, [day]: { ...times } };
    });

  const editLogo = () => {
    nameInput.current?.focus();
    showToast('Your logo is your restaurant’s initial — photo logos are coming soon');
  };

  const header = (
    <SupplierPageHeader
      title="Restaurant Information"
      titleStyle={styles.title}
      onBack={() => navigation.goBack()}
    />
  );

  if (load === 'loading') {
    return (
      <Screen>
        {header}
        <View style={styles.content}>
          <Skeleton height={130} borderRadius={0} />
          <Skeleton height={300} borderRadius={radius['3xl']} />
          <Skeleton height={240} borderRadius={radius['3xl']} />
        </View>
      </Screen>
    );
  }

  if (load === 'error' || load === 'missing' || !merchant) {
    return (
      <Screen>
        {header}
        <View style={[styles.content, styles.notice]}>
          <Text variant="h4" color={colors.text} align="center">
            {load === 'error' ? 'Could not load this restaurant' : 'Restaurant not found'}
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            {load === 'error'
              ? 'Check your connection and try again.'
              : 'That restaurant is no longer available on your account.'}
          </Text>
          {load === 'error' ? (
            <Button label="Try again" fullWidth={false} style={styles.retry} onPress={() => void loadRestaurant()} />
          ) : null}
        </View>
      </Screen>
    );
  }

  const initial = initials(name.trim() || merchant.name, 1, '·');
  const pinLabel = geo
    ? address.trim() || `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`
    : 'Pin not set';
  // After a failed Save the bar tracks what is still wrong, live; "All changes
  // saved" is true only until the next edit.
  const barMessage: Note | null =
    attempted && problems.length
      ? {
          text:
            problems.length === 1
              ? problems[0]!
              : `Fix the ${problems.length} highlighted items before saving.`,
          tone: 'error',
        }
      : message?.tone === 'ok' && dirty
        ? null
        : message;

  return (
    <Screen>
      {header}

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.coverBlock}>
          <LinearGradient
            colors={gradients.restaurantCover}
            // CSS 160° across a 361x130 box, in unit coordinates.
            start={{ x: 0.38, y: -0.39 }}
            end={{ x: 0.62, y: 1.39 }}
            style={styles.cover}
          >
            {/* No cover upload exists yet — drawn as in Figma, dimmed, and
                honest about it when tapped. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change cover"
              accessibilityHint="Cover photos are coming soon"
              onPress={() => showToast('Cover photos are coming soon')}
              style={styles.coverPill}
            >
              <Icon name="camera" size={15} color={colors.onPrimary} />
              <Text variant="label" color={colors.onPrimary}>
                Change Cover
              </Text>
            </Pressable>
          </LinearGradient>
          <View style={styles.logo}>
            <Text variant="pageTitle" color={colors.onPrimary}>
              {initial}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit logo"
              accessibilityHint="The logo is your restaurant's initial; this edits the name"
              onPress={editLogo}
              hitSlop={10}
              style={({ pressed }) => [styles.logoBadge, pressed && styles.pressed]}
            >
              <Icon name="pencilSm" size={9} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>

        <Card title="Basic Information" onLayout={trackSection('basic')}>
          <InfoField
            label="Restaurant Name"
            inputRef={nameInput}
            error={fieldError('name')}
            value={name}
            onChangeText={setName}
          />
          <InfoField
            label="Cuisine / Category"
            error={fieldError('cuisines')}
            value={cuisines}
            onChangeText={setCuisines}
            placeholder="e.g. Sri Lankan · Authentic"
          />
          <InfoField
            label="Short Description"
            multiline
            error={fieldError('tagline')}
            value={tagline}
            onChangeText={setTagline}
          />
        </Card>

        <Card title="Location" onLayout={trackSection('location')}>
          <InfoField
            label="Address"
            error={fieldError('address')}
            value={address}
            onChangeText={(v) => {
              setAddress(v);
              if (pinNote?.tone === 'error') setPinNote(null);
            }}
          />
          <View style={styles.map}>
            <LinearGradient
              colors={gradients.mapPreview}
              // CSS 163° across a 325x100 box.
              start={{ x: 0.41, y: -0.41 }}
              end={{ x: 0.59, y: 1.41 }}
              style={styles.fill}
            />
            <MapLines />
            <View style={styles.mapCenter} pointerEvents="none">
              <Svg width={28} height={36} viewBox="0 0 27.9976 35.9969">
                <Path
                  d="M13.999 1C7.36954 1 2 6.36954 2 12.999C2 21.9982 13.999 34.9971 13.999 34.9971C13.999 34.9971 25.9979 21.9982 25.9979 12.999C25.9979 6.36954 20.6284 1 13.999 1Z"
                  fill={geo ? colors.primary : colors.borderStrong}
                />
                <Path
                  d="M13.9992 17.9993C16.7607 17.9993 18.9992 15.7607 18.9992 12.9993C18.9992 10.2379 16.7607 7.99931 13.9992 7.99931C11.2378 7.99931 8.99923 10.2379 8.99923 12.9993C8.99923 15.7607 11.2378 17.9993 13.9992 17.9993Z"
                  fill={colors.surface}
                />
              </Svg>
              <View style={styles.pinLabel}>
                <Text variant="labelSm" color={geo ? colors.text : colors.textSecondary} numberOfLines={1}>
                  {pinLabel}
                </Text>
              </View>
            </View>
            <Pressable
              ref={setPinButton}
              accessibilityRole="button"
              accessibilityLabel={geo ? 'Move map pin' : 'Set map pin'}
              accessibilityState={{ busy: pinning, disabled: pinning }}
              disabled={pinning}
              onPress={() => measureAnchor(setPinButton, setPinMenu)}
              hitSlop={6}
              style={({ pressed }) => [styles.setPin, (pressed || pinning) && styles.pressed]}
            >
              <Icon name="crosshair" size={11} color={colors.palette.gray700} />
              <Text variant="captionBold" color={colors.palette.gray700}>
                {pinning ? 'Locating…' : 'Set Pin'}
              </Text>
            </Pressable>
          </View>
          {pinNote ? (
            <Text
              variant="bodySm"
              color={pinNote.tone === 'error' ? colors.primary : colors.textSecondary}
              accessibilityLiveRegion="polite"
            >
              {pinNote.text}
            </Text>
          ) : null}
        </Card>

        <Card title="Contact" onLayout={trackSection('contact')}>
          <InfoField
            label="Phone Number"
            error={fieldError('phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </Card>

        <View style={[styles.card, styles.hoursCard]} onLayout={trackSection('hours')}>
          <View style={styles.hoursHeader}>
            <View style={styles.hoursIcon}>
              <Icon name="clock" size={16} color={colors.primary} />
            </View>
            <Text variant="h5" color={colors.text} accessibilityRole="header">
              Opening Hours
            </Text>
          </View>
          <View style={styles.dayRows}>
            {DAYS.map(({ day, label }) => {
              const h = hours[day];
              const open = !h.closed;
              const invalid = dayInvalid(day);
              const problem = invalid ? dayHoursError(h) : null;
              const note = open && !problem ? hoursNote(h.open, h.close) : null;
              return (
                <View key={day} style={styles.dayRow}>
                  <View style={styles.dayLine}>
                    <View style={styles.dayMain}>
                      <Text variant="labelMd" color={open ? colors.text : colors.borderStrong} style={styles.dayLabel}>
                        {label}
                      </Text>
                      {open ? (
                        <View style={styles.times}>
                          <TextInput
                            accessibilityLabel={`${label} opening time`}
                            value={h.open}
                            onChangeText={(v) => setDay(day, { open: v })}
                            onBlur={() => tidyTime(day, 'open')}
                            placeholder="7:00 AM"
                            placeholderTextColor={colors.textMuted}
                            autoCorrect={false}
                            style={[styles.time, invalid && normaliseTime(h.open) === null && styles.timeInvalid]}
                          />
                          <Text variant="microRegular" color={colors.textMuted}>
                            –
                          </Text>
                          <TextInput
                            accessibilityLabel={`${label} closing time`}
                            value={h.close}
                            onChangeText={(v) => setDay(day, { close: v })}
                            onBlur={() => tidyTime(day, 'close')}
                            placeholder="10:00 PM"
                            placeholderTextColor={colors.textMuted}
                            autoCorrect={false}
                            style={[styles.time, invalid && normaliseTime(h.close) === null && styles.timeInvalid]}
                          />
                        </View>
                      ) : (
                        <View style={styles.closedPill}>
                          <Text variant="micro" color={colors.textMuted}>
                            Closed
                          </Text>
                        </View>
                      )}
                    </View>
                    <Toggle
                      small
                      label={`Open on ${label}`}
                      value={open}
                      onChange={() => toggleDay(day)}
                    />
                  </View>
                  {problem ? (
                    <Text variant="bodySm" color={colors.primary} accessibilityLiveRegion="polite">
                      {`${label}: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`}
                    </Text>
                  ) : note ? (
                    <Text variant="microRegular" color={colors.textSecondary}>
                      {note}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <Card title="Order Information" gap={spacing[5]} onLayout={trackSection('orders')}>
          <View>
            <Text variant="micro" color={colors.textSecondary}>
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
                    style={[styles.chip, on && styles.chipOn, flag('prepTime') && styles.chipInvalid]}
                  >
                    <Text variant="label" color={on ? colors.onPrimary : colors.textSecondary}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {fieldError('prepTime') ? (
              <Text variant="bodySm" color={colors.primary} style={styles.chipsError}>
                {fieldError('prepTime')}
              </Text>
            ) : null}
          </View>

          <View style={styles.deliveryRow}>
            <View style={styles.deliveryText}>
              <Text variant="labelMd" color={colors.text}>
                Delivery Available
              </Text>
              <Text variant="microRegular" color={colors.textMuted}>
                Allow home delivery
              </Text>
            </View>
            <Toggle
              label="Delivery Available"
              value={deliveryAvailable}
              onChange={() => setDeliveryAvailable((v) => !v)}
            />
          </View>

          {deliveryAvailable ? (
            <DeliveryTerms
              pricing={pricing}
              onPricing={setPricing}
              deliveryFee={deliveryFee}
              onDeliveryFee={setDeliveryFee}
              feeError={fieldError('deliveryFee')}
              freeKm={freeKm}
              onFreeKm={setFreeKm}
              perKm={perKm}
              onPerKm={setPerKm}
              limitArea={limitArea}
              onLimitArea={() => setLimitArea((v) => !v)}
              maxKm={maxKm}
              onMaxKm={setMaxKm}
              freeOver={freeOver}
              onFreeOver={setFreeOver}
              error={termsError}
              hasPin={!!geo}
              preview={{ ...terms, baseFee: fee }}
            />
          ) : null}
        </Card>
      </ScrollView>

      <View style={styles.saveBar}>
        {barMessage ? (
          <Text
            variant="bodySm"
            accessibilityLiveRegion="polite"
            color={
              barMessage.tone === 'ok'
                ? colors.palette.green600
                : barMessage.tone === 'info'
                  ? colors.textSecondary
                  : colors.primary
            }
          >
            {barMessage.text}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving}
          onPress={() => void save()}
          style={({ pressed }) => [styles.save, (pressed || saving) && styles.pressed]}
        >
          <Icon name="check" size={14} color={colors.onPrimary} />
          <Text variant="h5" color={colors.onPrimary}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Text>
        </Pressable>
      </View>

      <ActionMenu
        anchor={pinMenu}
        title="Place the pin at…"
        items={[
          {
            label: 'My current location',
            icon: 'crosshair',
            hint: 'Best when you are at the restaurant',
            onPress: () => void pinFromLocation(),
          },
          {
            label: 'The address above',
            icon: 'mapPin',
            disabled: !CAN_GEOCODE,
            hint: CAN_GEOCODE
              ? address.trim()
                ? address.trim()
                : 'Enter the address first'
              : 'Needs the A-Z Globe phone app — not available on the web',
            onPress: () => void pinFromAddress(),
          },
        ]}
        onClose={() => setPinMenu(null)}
      />
    </Screen>
  );
}

/** A white section card with its tracked heading — Figma 394:2740. */
function Card({
  title,
  gap = spacing[4],
  onLayout,
  children,
}: {
  title: string;
  gap?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card} onLayout={onLayout}>
      <Text variant="eyebrowSm" color={colors.textMuted} style={styles.eyebrow} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.cardBody, { gap }]}>{children}</View>
    </View>
  );
}

/** SupplierField with this screen's plain sentence-case label and smaller box. */
function InfoField(props: Omit<SupplierFieldProps, 'labelVariant' | 'labelColor'>) {
  const { multiline, style, ...rest } = props;
  return (
    <SupplierField
      {...rest}
      multiline={multiline}
      labelVariant="micro"
      labelColor={colors.textSecondary}
      containerStyle={styles.field}
      style={[styles.input, multiline && styles.inputMultiline, style]}
    />
  );
}

function Toggle({
  value,
  onChange,
  label,
  small,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={onChange}
      hitSlop={8}
      style={[styles.switch, small && styles.switchSm, value && styles.switchOn]}
    >
      <View
        style={[
          styles.knob,
          small && styles.knobSm,
          value && (small ? styles.knobSmOn : styles.knobOn),
        ]}
      />
    </Pressable>
  );
}

/**
 * Delivery terms, under "Delivery Available":
 *
 *   pricing   Flat fee | By distance (the prep-time chip style)
 *   flat      Delivery Fee
 *   distance  Free within (km) + Per km (Rs.), then an optional base fee
 *   area      "Limit delivery area" switch + Deliver up to (km)
 *   waiver    Free delivery on orders over (Rs., optional)
 *   preview   what customers pay at each distance, and "Not delivered" past
 *             the limit — the same table the rules and checkout follow
 *
 * Distances are straight-line from the map pin, so distance pricing and the
 * area limit need it; the pin hint says so and Save scrolls up to it.
 */
function DeliveryTerms({
  pricing,
  onPricing,
  deliveryFee,
  onDeliveryFee,
  feeError,
  freeKm,
  onFreeKm,
  perKm,
  onPerKm,
  limitArea,
  onLimitArea,
  maxKm,
  onMaxKm,
  freeOver,
  onFreeOver,
  error,
  hasPin,
  preview,
}: {
  pricing: 'flat' | 'distance';
  onPricing: (p: 'flat' | 'distance') => void;
  deliveryFee: string;
  onDeliveryFee: (v: string) => void;
  feeError: string | null;
  freeKm: string;
  onFreeKm: (v: string) => void;
  perKm: string;
  onPerKm: (v: string) => void;
  limitArea: boolean;
  onLimitArea: () => void;
  maxKm: string;
  onMaxKm: (v: string) => void;
  freeOver: string;
  onFreeOver: (v: string) => void;
  error: (field: DeliveryTermsField) => string | null;
  hasPin: boolean;
  preview: {
    pricing: 'flat' | 'distance';
    freeKm: number;
    perKm: number;
    limitArea: boolean;
    maxKm: number;
    freeOver: number | null;
    baseFee: number;
  };
}) {
  const distance = pricing === 'distance';
  // The preview only draws figures that parse; a half-typed field hides it.
  const rules = {
    pricing,
    freeKm: distance ? preview.freeKm : 0,
    perKm: distance ? preview.perKm : 0,
    maxKm: preview.limitArea ? preview.maxKm : 0,
  };
  const previewable =
    Number.isFinite(preview.baseFee) &&
    (!distance || (Number.isFinite(rules.freeKm) && Number.isFinite(rules.perKm))) &&
    (!preview.limitArea || (Number.isFinite(rules.maxKm) && rules.maxKm > 0));
  const rows = previewable ? feeSchedule(rules, preview.baseFee) : [];
  const waiver = preview.freeOver != null && Number.isFinite(preview.freeOver) && preview.freeOver > 0 ? preview.freeOver : null;

  return (
    <View style={styles.terms}>
      <View>
        <Text variant="micro" color={colors.textSecondary}>
          Delivery Pricing
        </Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {(
            [
              ['flat', 'Flat fee'],
              ['distance', 'By distance'],
            ] as const
          ).map(([value, label]) => {
            const on = pricing === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => onPricing(value)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text variant="label" color={on ? colors.onPrimary : colors.textSecondary}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {distance ? (
        <>
          <View style={styles.termsRow}>
            <View style={styles.flex}>
              <InfoField
                label="Free within (km)"
                error={error('freeKm')}
                value={freeKm}
                onChangeText={onFreeKm}
                keyboardType="decimal-pad"
                placeholder="1"
              />
            </View>
            <View style={styles.flex}>
              <InfoField
                label="Then per km"
                error={error('perKm')}
                value={perKm}
                onChangeText={onPerKm}
                keyboardType="decimal-pad"
                placeholder="Rs. 50"
              />
            </View>
          </View>
          <InfoField
            label="Base fee (optional)"
            error={feeError}
            value={deliveryFee}
            onChangeText={onDeliveryFee}
            keyboardType="decimal-pad"
            placeholder="Rs. 0"
            hint="Added once the address is past the free distance. Leave Rs. 0 to charge per km only."
          />
        </>
      ) : (
        <InfoField
          label="Delivery Fee"
          error={feeError}
          value={deliveryFee}
          onChangeText={onDeliveryFee}
          keyboardType="decimal-pad"
          placeholder="Rs. 150"
        />
      )}

      <View style={styles.deliveryRow}>
        <View style={styles.deliveryText}>
          <Text variant="labelMd" color={colors.text}>
            Limit Delivery Area
          </Text>
          <Text variant="microRegular" color={colors.textMuted}>
            Only deliver within a set distance
          </Text>
        </View>
        <Toggle label="Limit Delivery Area" value={limitArea} onChange={onLimitArea} small />
      </View>
      {limitArea ? (
        <InfoField
          label="Deliver up to (km)"
          error={error('maxKm')}
          value={maxKm}
          onChangeText={onMaxKm}
          keyboardType="decimal-pad"
          placeholder="5"
        />
      ) : null}

      <InfoField
        label="Free delivery on orders over (optional)"
        error={error('freeOver')}
        value={freeOver}
        onChangeText={onFreeOver}
        keyboardType="decimal-pad"
        placeholder="e.g. Rs. 2000"
      />

      {(distance || limitArea) && !hasPin ? (
        <View style={styles.termsWarn} accessibilityRole="alert">
          <Icon name="mapPin" size={14} color={colors.primary} />
          <Text variant="bodySm" color={error('deliveryPin') ? colors.primary : colors.textSecondary} style={styles.flex}>
            Set your map pin under Location — delivery distance is measured from it.
          </Text>
        </View>
      ) : null}

      {rows.length ? (
        <View style={styles.preview} accessibilityLabel="What customers pay for delivery">
          <Text variant="eyebrowSm" color={colors.textMuted}>
            What customers pay
          </Text>
          {rows.map((row) => (
            <View key={`${row.fromKm}-${row.toKm}`} style={styles.previewRow}>
              <Text variant="bodySm" color={colors.textSecondary}>
                {distance || limitArea
                  ? `${formatKm(row.fromKm)} – ${formatKm(row.toKm)} km`
                  : 'Any distance'}
              </Text>
              <Text variant="label" color={row.fee === 0 ? colors.palette.green600 : colors.text}>
                {row.fee === 0 ? 'Free' : formatMoney(row.fee)}
              </Text>
            </View>
          ))}
          {!distance && !limitArea ? null : limitArea ? (
            <View style={styles.previewRow}>
              <Text variant="bodySm" color={colors.textSecondary}>
                Beyond {formatKm(rules.maxKm)} km
              </Text>
              <Text variant="label" color={colors.primary}>
                Not delivered
              </Text>
            </View>
          ) : (
            <Text variant="microRegular" color={colors.textMuted}>
              …and {formatMoney(rules.perKm)} more for each km after that.
            </Text>
          )}
          <Text variant="microRegular" color={colors.textMuted}>
            {waiver ? `Orders over ${formatMoney(waiver)} deliver free. ` : ''}
            {distance || limitArea ? 'Straight-line distance from your map pin; part of a km counts as a full km.' : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The illustrated street grid behind the pin — Figma 394:2787. */
function MapLines() {
  return (
    <View style={styles.fill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 323.621 98.9795" preserveAspectRatio="none">
        {[64.7242, 129.448, 194.173, 258.897].map((x) => (
          <Path key={x} d={`M${x} -4.44708V103.427`} stroke={colors.palette.mapGrid} strokeWidth={0.647242} />
        ))}
        <Path d="M0 31.1512H323.621" stroke={colors.palette.mapGrid} strokeWidth={0.647242} />
        <Path d="M0 66.7495H323.621" stroke={colors.palette.mapGrid} strokeWidth={0.647242} />
        <Path
          d="M0 60.2771C28.7663 54.5239 57.5326 53.8047 86.2989 58.1196C115.065 63.1537 143.832 62.075 172.598 54.8834C201.364 47.6919 230.13 46.6131 258.897 51.6472C280.472 55.243 302.046 54.5239 323.621 49.4898"
          stroke={colors.palette.mapRoad}
          strokeWidth={1.29448}
          fill="none"
        />
        <Path
          d="M32.3621 -4.44708C35.9579 17.1277 39.5537 53.0855 43.1495 103.427"
          stroke={colors.palette.mapRoad}
          strokeWidth={1.07874}
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.pageTitle, marginTop: spacing[4] },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing[4],
    paddingBottom: spacing[9],
    gap: spacing[6],
  },
  notice: { alignItems: 'center', paddingTop: spacing[12], gap: spacing[3] },
  retry: { marginTop: spacing[4], paddingHorizontal: spacing[9] },

  coverBlock: { height: 150 },
  cover: { height: 130, alignItems: 'center', justifyContent: 'center' },
  coverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingVertical: 7,
    paddingHorizontal: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.glassDark,
    // Dimmed: there is no upload behind it yet.
    opacity: 0.6,
  },
  logo: {
    position: 'absolute',
    left: spacing[6],
    top: 100,
    width: 52,
    height: 52,
    borderRadius: radius['3xl'],
    borderWidth: 2.55,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
  logoBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.53,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },

  card: {
    padding: spacing[6],
    borderRadius: radius['3xl'],
    borderWidth: 0.51,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.formCard,
  },
  eyebrow: { textTransform: 'uppercase' },
  cardBody: { paddingTop: spacing[3.5] },
  field: { gap: spacing[2] },
  input: {
    ...typography.labelMd,
    height: 42.5,
    paddingVertical: 11,
  },
  inputMultiline: { height: 81.5, fontFamily: fontFamily[400] },

  map: {
    height: 100,
    marginTop: spacing[4],
    borderRadius: radius['2xl'],
    borderWidth: 0.51,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mapCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingHorizontal: 80,
  },
  pinLabel: {
    maxWidth: '100%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
    backgroundColor: colors.glassLight,
    ...shadows.raised,
  },
  setPin: {
    position: 'absolute',
    right: spacing[3],
    bottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 0.51,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },

  hoursCard: { padding: spacing[7], borderRadius: radius['4xl'] },
  hoursHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  hoursIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRows: { paddingTop: spacing[5], gap: spacing[0.5] },
  dayRow: {
    minHeight: 45,
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.palette.gray25,
  },
  dayLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  dayMain: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexShrink: 1 },
  dayLabel: { width: 32 },
  times: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], flexShrink: 1 },
  time: {
    ...typography.labelSm,
    color: colors.text,
    width: 68,
    height: 25.5,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 0,
    borderRadius: radius.md,
    borderWidth: 0.51,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  timeInvalid: { borderColor: colors.primary },
  closedPill: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3.5],
    borderRadius: radius.pill,
    borderWidth: 0.51,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], paddingTop: spacing[3] },
  chip: {
    height: 33,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 0.51,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipInvalid: { borderColor: colors.primary },
  chipsError: { paddingTop: spacing[2.5] },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[4] },
  deliveryText: { flexShrink: 1 },
  terms: { gap: spacing[5] },
  flex: { flex: 1, minWidth: 0 },
  termsRow: { flexDirection: 'row', gap: spacing[4] },
  termsWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
  },
  preview: {
    gap: spacing[2.5],
    padding: spacing[5],
    borderRadius: radius.xl,
    borderWidth: 0.51,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[4] },

  switch: { width: 44, height: 24, borderRadius: radius.pill, backgroundColor: colors.border, justifyContent: 'center' },
  switchSm: { width: 40, height: 22 },
  switchOn: { backgroundColor: colors.primary },
  knob: {
    width: 18,
    height: 18,
    marginLeft: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  knobOn: { marginLeft: 23 },
  knobSm: { width: 17, height: 17, marginLeft: 2.5 },
  knobSmOn: { marginLeft: 20.5 },

  saveBar: {
    gap: spacing[3],
    paddingVertical: 12.5,
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.surface,
    borderTopWidth: 0.51,
    borderTopColor: colors.border,
  },
  save: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2.5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.6 },
});
