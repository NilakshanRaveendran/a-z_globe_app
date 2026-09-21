import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@core/theme';
import { Icon, Text } from '@core/ui';
import { SupplierField } from '../components/SupplierField';
import { createMenuItem } from '../services/menu';

/**
 * Add a dish to a restaurant's menu.
 *
 * Composed from the Add Restaurant sheet's own vocabulary (385:4028) — the same
 * panel, grip, header, footer and field treatment — because Figma has no
 * separate "add dish" sheet, only the menu grid it returns to (176:2923). The
 * category chips are that grid's filter row, so the two stay in step.
 *
 * `image` is a bundled asset KEY, not an upload. Cloud Storage needs the Blaze
 * plan and this project is on Spark, so a supplier picks from the artwork that
 * ships with the app. Swapping to real uploads is one field change here plus a
 * Storage write — see the note in the README.
 */
const CATEGORIES = ['Burgers', 'Pizza', 'Sushi', 'Salads', 'Desserts', 'Drinks', 'Rice'];

/** Bundled dish artwork, resolved by `resolveImage` in the food module. */
const IMAGE_KEYS = ['kottu', 'dosa', 'samosa', 'rotty-set', 'lime-juice', 'wood-apple'];

type Props = {
  visible: boolean;
  merchantId: string;
  merchantName: string;
  onClose: () => void;
  onCreated: () => void;
};

export function AddMenuItemSheet({
  visible,
  merchantId,
  merchantName,
  onClose,
  onCreated,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [image, setImage] = useState(IMAGE_KEYS[0]!);

  const priceValue = Number(price.replace(/[^\d]/g, ''));
  const canSubmit = name.trim().length >= 2 && priceValue > 0;

  const reset = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategory(CATEGORIES[0]!);
    setImage(IMAGE_KEYS[0]!);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createMenuItem(merchantId, merchantName, {
        name,
        description,
        price: priceValue,
        category,
        image,
      });
      reset();
      onCreated();
    } catch {
      setError('Could not add the dish. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />

        <View style={[styles.panel, { paddingBottom: spacing[12] + insets.bottom }]}>
          <View style={styles.gripRow}>
            <View style={styles.grip} />
          </View>

          <View style={styles.header}>
            <View>
              <Text variant="h2" color={colors.text}>
                Add Item
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {merchantName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              style={styles.close}
            >
              <Icon name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SupplierField
              label="Dish Name"
              required
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken Kottu"
            />
            <SupplierField
              label="Price (Rs.)"
              required
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              placeholder="e.g. 950"
            />
            <SupplierField
              label="Description"
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="What is in it?"
            />

            <View style={styles.field}>
              <Text variant="eyebrowSm" color={colors.textMuted}>
                Category
              </Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => {
                  const on = c === category;
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setCategory(c)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text variant="bodySm" color={on ? colors.onPrimary : colors.textSecondary}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text variant="eyebrowSm" color={colors.textMuted}>
                Photo
              </Text>
              <View style={styles.chips}>
                {IMAGE_KEYS.map((k) => {
                  const on = k === image;
                  return (
                    <Pressable
                      key={k}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setImage(k)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text variant="bodySm" color={on ? colors.onPrimary : colors.textSecondary}>
                        {k.replace(/-/g, ' ')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="microRegular" color={colors.textMuted}>
                Photo uploads need Cloud Storage, which is not on the free plan yet — pick the
                closest for now.
              </Text>
            </View>

            {error ? (
              <Text variant="bodySm" color={colors.primary}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit || busy}
              onPress={() => void submit()}
              style={[styles.cta, (!canSubmit || busy) && styles.ctaDisabled]}
            >
              <Icon name="check" size={16} color={colors.onPrimary} />
              <Text variant="h4" color={colors.onPrimary}>
                {busy ? 'Adding…' : 'Add to Menu'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['5xl'],
    borderTopRightRadius: radius['5xl'],
    maxHeight: '90%',
  },
  gripRow: { paddingTop: spacing[4], alignItems: 'center' },
  grip: { width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[8],
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: spacing[8], paddingBottom: spacing[9], gap: spacing[5] },
  field: { gap: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2.5] },
  chip: {
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: colors.primary },
  footer: {
    paddingTop: spacing[3.5],
    paddingHorizontal: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  cta: {
    height: 50,
    flexDirection: 'row',
    gap: spacing[2.5],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
  },
  ctaDisabled: { opacity: 0.5 },
});
