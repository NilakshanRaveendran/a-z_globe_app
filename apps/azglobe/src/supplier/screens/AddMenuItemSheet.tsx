import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MAX_WIDTH, colors, fontFamily, radius, shadows, spacing, text } from '@core/theme';
import { Icon, Text } from '@core/ui';
import { Alert } from '@core/ui/alert';
import { resolveImage, type FoodImageKey } from '@modules/food/data/images';
import type { MenuItem } from '@modules/food/types';
import { SupplierField } from '../components/SupplierField';
import {
  categoryKey,
  createMenuItem,
  deleteMenuItem,
  MENU_CATEGORIES,
  orderCategories,
  updateMenuItem,
} from '../services/menu';

/**
 * Add New Item — Figma 463:2991. The same sheet edits a dish when its pencil
 * is tapped on Menu Management (176:2923).
 *
 *   panel     r24 top · #FFFFFF · pad 20/20/40 · shadow 0 -4 12 12%
 *   grip      40x4 #E5E7EB pill
 *   header    "Add New Item" 700 18/27 #1F2937 · 32pt #F3F4F6 close, 12pt X
 *   labels    600 12/18 #374151, 6 above the control · 16 between fields
 *   photo     a row: 96pt square preview (dashed red "Add photo" when empty) ·
 *             name + hint · outlined "Change photo" button; it opens the dish
 *             library below — four square tiles a row, named, ticked when chosen
 *   inputs    h47 · r12 · #F9FAFB · 1px #E5E7EB · pad 16/12 · 400 14 (description h108)
 *   category  chips pad 12/6 pill, 7 apart · on #D42B2B/white · off #F3F4F6/#6B7280
 *             600 12/18 · a trailing "+" chip
 *   cta       full width · pad 14 · r14 · #D42B2B · "Add to Menu" 700 15/22.5 white;
 *             editing puts an outlined red "Delete" button beside "Save Changes"
 *
 * The CTA sits in a sticky footer (0.51 #F3F4F6 rule, pad 10/20) so "Add to
 * Menu" is on screen at 320×640 without scrolling; Photo, Name and Price carry
 * the required asterisk; closing with changes asks first.
 *
 * Two deliberate departures, both because the product needs them:
 *   - Price. Figma draws no price field, but a dish cannot be sold without one,
 *     so it sits under Item Name in the same treatment. It accepts decimals.
 *   - Photo. Cloud Storage needs the Blaze plan and this project is on Spark, so
 *     there is no upload: the drop zone opens the dish photos that ship with the
 *     app (`image` stores a bundled-asset KEY) and the copy says so rather than
 *     promising "JPG, PNG up to 5 MB". Real uploads are this field plus a
 *     Storage write.
 */

/**
 * Bundled dish photos a supplier can pick from, resolved by `resolveImage`,
 * each once and under what it shows. (`pol-sambol-rice.jpg` is really the lime
 * juice photo and `curry-roti` repeats the rotty set, so neither is offered;
 * dishes already saved with those keys still display.)
 */
const DISH_PHOTOS: FoodImageKey[] = [
  'kottu',
  'dosa',
  'samosa',
  'rotty-set',
  'mix-nasi-goreng',
  'grilled-chicken-burger',
  'margherita-pizza',
  'spicy-tuna-roll',
  'caesar-salad',
  'pancakes',
  'chocolate-lava-cake',
  'mango-lassi',
  'lime-juice',
  'rotty-set-alt',
];

/** Short names that fit under a library tile. */
const PHOTO_NAMES: Partial<Record<string, string>> = {
  'mix-nasi-goreng': 'Nasi goreng',
  'grilled-chicken-burger': 'Burger',
  'margherita-pizza': 'Pizza',
  'spicy-tuna-roll': 'Sushi roll',
  'chocolate-lava-cake': 'Lava cake',
  'rotty-set-alt': 'Fruit juice',
  'pol-sambol-rice': 'Lime juice',
  'curry-roti': 'Rotty set',
};

const THUMB_COLUMNS = 4;
const THUMB_GAP = spacing[4];

/** "mango-lassi" → "Mango lassi" — the name under each library photo. */
function photoName(key: string): string {
  const named = PHOTO_NAMES[key];
  if (named) return named;
  const words = key.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Digits and at most one decimal point with two places — "12.50", not "1250". */
export function sanitizePrice(input: string): string {
  const [whole = '', ...rest] = input.replace(/[^\d.]/g, '').split('.');
  return rest.length === 0 ? whole : `${whole}.${rest.join('').slice(0, 2)}`;
}

/** The typed price as a number, or NaN when it is not a usable price. */
export function parsePrice(input: string): number {
  const value = Number(sanitizePrice(input));
  return input.trim() && Number.isFinite(value) && value > 0 ? value : NaN;
}

/** What the sheet did, so the menu can confirm it and show the dish. */
export type MenuSaveResult = {
  kind: 'added' | 'updated' | 'deleted';
  name: string;
  category: string;
};

type Props = {
  visible: boolean;
  merchantId: string;
  merchantName: string;
  /** The dish being edited. Absent (or null) when adding a new one. */
  item?: MenuItem | null;
  /** Categories already on this menu, so a new dish can join one of them. */
  categories?: string[];
  /** Preselected category for a new dish, e.g. the filter the grid is on. */
  initialCategory?: string;
  onClose: () => void;
  /** Called after a successful add, edit or delete. */
  onSaved: (result: MenuSaveResult) => void;
};

export function AddMenuItemSheet({
  visible,
  merchantId,
  merchantName,
  item,
  categories = [],
  initialCategory,
  onClose,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const editing = Boolean(item);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState('');
  const [picking, setPicking] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [custom, setCustom] = useState<string[]>([]);
  const [draftCategory, setDraftCategory] = useState<string | null>(null);

  const options = useMemo(
    () => orderCategories([...categories, ...(item ? [item.category] : []), ...MENU_CATEGORIES, ...custom]),
    [categories, item, custom]
  );

  // What the form held when it opened, to tell whether closing loses anything.
  const initial = useRef('');
  const snapshot = (form: { name: string; description: string; price: string; category: string; image: string }) =>
    JSON.stringify(form);

  // Load the form each time the sheet opens: blank to add, the dish to edit.
  useEffect(() => {
    if (!visible) return;
    const form = {
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item ? (Number.isInteger(item.price) ? String(item.price) : item.price.toFixed(2)) : '',
      category: item?.category ?? initialCategory ?? '',
      image: item?.image ?? '',
    };
    initial.current = snapshot(form);
    setName(form.name);
    setDescription(form.description);
    setPrice(form.price);
    setCategory(form.category);
    setImage(form.image);
    setPicking(false);
    setCustom([]);
    setDraftCategory(null);
    setAttempted(false);
    setError(null);
  }, [visible, item, initialCategory]);

  const selectedCategory = category || options[0] || '';
  const priceValue = parsePrice(price);
  const missing = {
    image: !image,
    name: name.trim().length < 2,
    price: Number.isNaN(priceValue),
  };
  const valid = !missing.image && !missing.name && !missing.price;
  const dirty = snapshot({ name, description, price, category, image }) !== initial.current;

  // The scrim, ✕ and Android back all come here.
  const close = () => {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(editing ? 'Discard your changes?' : 'Discard this dish?', 'What you entered will be lost.', [
      { text: 'Discard', style: 'destructive', onPress: onClose },
      { text: 'Keep editing', style: 'cancel' },
    ]);
  };

  const commitDraftCategory = () => {
    const next = draftCategory?.trim();
    setDraftCategory(null);
    if (!next) return;
    setCustom((prev) => [...prev, next]);
    // "burgers" typed next to an existing "Burger" chip selects that chip.
    setCategory(options.find((c) => categoryKey(c) === categoryKey(next)) ?? next);
  };

  const submit = async () => {
    setAttempted(true);
    if (!valid) {
      setError('Add a photo, a name and a price to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    const input = {
      name,
      description,
      price: Math.round(priceValue * 100) / 100,
      category: selectedCategory,
      image,
    };
    try {
      if (item) await updateMenuItem(merchantId, item.id, input);
      else await createMenuItem(merchantId, merchantName, input);
      onSaved({ kind: item ? 'updated' : 'added', name: input.name.trim(), category: input.category });
    } catch {
      setError(
        editing
          ? 'Could not save the dish. Check your connection and try again.'
          : 'Could not add the dish. Check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!item) return;
    Alert.alert('Delete this dish?', `${item.name} will be removed from your menu. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteMenuItem(merchantId, item.id);
            onSaved({ kind: 'deleted', name: item.name, category: item.category });
          } catch {
            setError('Could not delete the dish. Check your connection and try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />

        <View style={styles.panel}>
          <View style={styles.gripRow}>
            <View style={styles.grip} />
          </View>

          <View style={styles.header}>
            <Text variant="h2" color={colors.text}>
              {editing ? 'Edit Item' : 'Add New Item'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              hitSlop={6}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Icon name="close" size={12} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.field}>
              <Text variant="label" color={colors.palette.gray700}>
                Product Image *
              </Text>
              {/* Preview + action row. The preview is square — the shape the
                  menu card and the dish page crop it to — so what you see is
                  what customers get, instead of a thin banner of the middle. */}
              <View style={[styles.photoRow, attempted && missing.image && styles.photoRowInvalid]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={image ? 'Change photo' : 'Choose photo'}
                  onPress={() => setPicking((v) => !v)}
                  style={({ pressed }) => [styles.photo, !image && styles.photoEmpty, pressed && styles.pressed]}
                >
                  {image ? (
                    <Image source={resolveImage(image)} style={styles.photoImage} contentFit="cover" transition={120} />
                  ) : (
                    <>
                      <Icon name="uploadPhoto" size={22} color={colors.primary} />
                      <Text variant="labelSm" color={colors.primary}>
                        Add photo
                      </Text>
                    </>
                  )}
                </Pressable>
                <View style={styles.photoInfo}>
                  <Text variant="labelMd" color={colors.text} numberOfLines={1}>
                    {image ? photoName(image) : 'No photo yet'}
                  </Text>
                  <Text variant="microRegular" color={colors.textMuted}>
                    {image
                      ? 'Shown on your menu and the dish page.'
                      : 'Pick one from the dish photo library.'}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: picking }}
                    onPress={() => setPicking((v) => !v)}
                    style={({ pressed }) => [styles.photoButton, picking && styles.photoButtonOn, pressed && styles.pressed]}
                  >
                    <Icon name={image ? 'pencilSm' : 'plus'} size={12} color={picking ? colors.primary : colors.text} />
                    <Text variant="label" color={picking ? colors.primary : colors.text}>
                      {image ? 'Change photo' : 'Choose photo'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {picking ? (
                <View style={styles.library}>
                  <View style={styles.libraryHead}>
                    <Text variant="labelMd" color={colors.text} style={styles.flex}>
                      Dish photo library
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close the photo library"
                      onPress={() => setPicking(false)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.libraryClose, pressed && styles.pressed]}
                    >
                      <Icon name="close" size={12} color={colors.text} />
                    </Pressable>
                  </View>
                  {/* Four square tiles a row, sized from the measured width so
                      the grid fills the card evenly at any screen size. A
                      wrapping grid, not a strip: a strip can't be scrolled
                      with a mouse wheel on the web. */}
                  <View
                    style={styles.thumbs}
                    onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
                  >
                    {gridWidth > 0
                      ? DISH_PHOTOS.map((key) => {
                          const on = key === image;
                          const size = (gridWidth - THUMB_GAP * (THUMB_COLUMNS - 1)) / THUMB_COLUMNS;
                          return (
                            <Pressable
                              key={key}
                              accessibilityRole="button"
                              accessibilityLabel={photoName(key)}
                              accessibilityState={{ selected: on }}
                              onPress={() => {
                                setImage(key);
                                setPicking(false);
                              }}
                              style={({ pressed }) => [{ width: size }, styles.thumbCell, pressed && styles.pressed]}
                            >
                              <View style={[styles.thumb, { width: size, height: size }, on && styles.thumbOn]}>
                                <Image source={resolveImage(key)} style={styles.thumbImage} contentFit="cover" />
                                {on ? (
                                  <View style={styles.thumbCheck}>
                                    <Icon name="check" size={11} color={colors.onPrimary} />
                                  </View>
                                ) : null}
                              </View>
                              <Text
                                variant="microRegular"
                                color={on ? colors.primary : colors.textSecondary}
                                numberOfLines={1}
                                align="center"
                              >
                                {photoName(key)}
                              </Text>
                            </Pressable>
                          );
                        })
                      : null}
                  </View>
                </View>
              ) : null}
            </View>

            <SupplierField
              label="Item Name"
              required
              labelVariant="label"
              labelColor={colors.palette.gray700}
              containerStyle={styles.field}
              style={styles.input}
              invalid={attempted && missing.name}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Butter Chicken Rice"
              maxLength={60}
            />
            <SupplierField
              label="Price (Rs.)"
              required
              labelVariant="label"
              labelColor={colors.palette.gray700}
              containerStyle={styles.field}
              style={styles.input}
              invalid={attempted && missing.price}
              value={price}
              onChangeText={(t) => setPrice(sanitizePrice(t))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="e.g. 850 or 12.50"
            />
            <SupplierField
              label="Description"
              labelVariant="label"
              labelColor={colors.palette.gray700}
              containerStyle={styles.field}
              style={[styles.input, styles.textarea]}
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="What’s in it?"
              maxLength={240}
            />

            <View style={styles.field}>
              <Text variant="label" color={colors.palette.gray700}>
                Category
              </Text>
              <View style={styles.chips}>
                {options.map((c) => {
                  const on = categoryKey(c) === categoryKey(selectedCategory);
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setCategory(c)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text variant="label" color={on ? colors.onPrimary : colors.textSecondary} numberOfLines={1}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
                {draftCategory !== null ? (
                  <TextInput
                    autoFocus
                    value={draftCategory}
                    onChangeText={setDraftCategory}
                    onSubmitEditing={commitDraftCategory}
                    onBlur={commitDraftCategory}
                    placeholder="New category"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    maxLength={20}
                    accessibilityLabel="New category name"
                    style={[styles.chip, styles.chipInput]}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a category"
                    onPress={() => setDraftCategory('')}
                    style={styles.chip}
                  >
                    <Text variant="label" color={colors.textSecondary}>
                      +
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

          </ScrollView>

          <View style={[styles.footer, { paddingBottom: spacing[8] + insets.bottom }]}>
            {error ? (
              <Text variant="bodySm" color={colors.primary} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {/* Editing: Delete sits beside Save as a real (outlined, red)
                button rather than a link lost at the end of the form. */}
            <View style={styles.actions}>
              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete item"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={confirmDelete}
                  style={({ pressed }) => [styles.deleteButton, (busy || pressed) && styles.pressed]}
                >
                  <Icon name="trash" size={16} color={colors.primary} />
                  <Text variant="h4" color={colors.primary}>
                    Delete
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy, disabled: busy }}
                disabled={busy}
                onPress={() => void submit()}
                style={({ pressed }) => [styles.cta, (busy || pressed) && styles.pressed]}
              >
                <Text variant="h4" color={colors.onPrimary}>
                  {busy ? 'Saving…' : editing ? 'Save Changes' : 'Add to Menu'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Capped to the app's column and centred — see APP_MAX_WIDTH.
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: {
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['5xl'],
    borderTopRightRadius: radius['5xl'],
    maxHeight: '92%',
    ...shadows.sheet,
  },
  gripRow: { paddingTop: spacing[8], alignItems: 'center' },
  grip: { width: 40, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[8],
    paddingHorizontal: spacing[8],
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingTop: spacing[8], paddingHorizontal: spacing[8], paddingBottom: spacing[8], gap: spacing[6] },
  flex: { flex: 1 },
  field: { gap: spacing[2.5] },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    padding: spacing[4],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  photoRowInvalid: { borderColor: colors.status.danger },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.surfaceAlt,
  },
  photoEmpty: {
    borderWidth: 1.6,
    borderStyle: 'dashed',
    borderColor: colors.primaryOutline,
    backgroundColor: colors.primaryTint,
  },
  photoImage: { width: '100%', height: '100%' },
  photoInfo: { flex: 1, minWidth: 0, gap: spacing[1] },
  photoButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photoButtonOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  library: {
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  libraryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  libraryClose: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: THUMB_GAP, rowGap: spacing[5] },
  thumbCell: { gap: spacing[1.5] },
  thumb: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
  },
  thumbOn: { borderColor: colors.primary },
  thumbImage: { width: '100%', height: '100%' },
  thumbCheck: {
    position: 'absolute',
    top: spacing[1.5],
    right: spacing[1.5],
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  input: {
    height: 47,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    backgroundColor: colors.surfaceSunken,
    fontFamily: fontFamily[400],
  },
  textarea: { height: 108, paddingTop: spacing[4], ...text(16, 400, 24) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  chipInput: {
    width: 120,
    ...text(14, 600, 20),
    color: colors.text,
  },
  footer: {
    gap: spacing[3],
    paddingTop: spacing[3.5],
    paddingHorizontal: spacing[8],
    borderTopWidth: 0.51,
    borderTopColor: colors.surfaceAlt,
  },
  actions: { flexDirection: 'row', gap: spacing[4] },
  cta: {
    flex: 2,
    paddingVertical: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2.5],
    paddingVertical: spacing[5],
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.6 },
});
