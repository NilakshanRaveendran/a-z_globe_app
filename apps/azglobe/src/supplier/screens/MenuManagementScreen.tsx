import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, fontFamily, radius, SCREEN_PADDING, shadows, spacing, typography } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, Text, showToast } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import { SupplierHeaderAction, SupplierPageHeader } from '../components/SupplierPageHeader';
import type { MenuItem } from '@modules/food/types';
import { resolveImage } from '@modules/food/data/images';
import type { RootStackParamList } from '@app/navigation/types';
import { AddMenuItemSheet, type MenuSaveResult } from './AddMenuItemSheet';
import { categoryKey, listAllMenuItems, orderCategories, setMenuItemAvailable } from '../services/menu';

/**
 * Menu management — Figma 176:2923.
 *
 *   header      back · red "+ Add Item" pill · "Menu Management" 700 22/33, 12
 *               above · "Manage your <Mama's Kitchen> menu in here." 400 13/19.5
 *               #6B7280 with the name 700 #D42B2B · no bottom rule
 *   filter row  pad 12 top / 16 sides · chips 8 apart, pad 14/6 pill, 600 12/18 ·
 *               "All" on #D42B2B/white, the rest #F3F4F6/#6B7280
 *   grid        2 columns, 12 apart, 20 below the chips · 16 sides
 *   card        r16 · #FFFFFF · 0.54px #D42B2B@15% · shadow 0 2 8 #D42B2B@7% ·
 *               photo 100h · body pad 10/12/12 · name 700 13/16.25 #1F2937 ·
 *               tag #F3F4F6 r6 pad 6/2 500 11/16.5 #6B7280 · price 800 14/21
 *               #D42B2B · 12 above the actions: "Make it unavailable" #FFF1F0
 *               r10 pad 8, 1px #D42B2B@7%, 600 11/16.5 #D42B2B · 8 · 32pt
 *               #F3F4F6 r10 edit with a 13pt #374151 pencil
 *
 * An unavailable dish keeps its place: the photo dims under an "Unavailable"
 * badge and the button turns solid, reading "Make it available". Deleting a
 * dish lives in the edit sheet (the pencil), behind a confirmation.
 *
 * Every change is confirmed with a toast. A new dish switches the filter to its
 * category, so it is on screen even when it started a new one, and the chip
 * row scrolls to whichever chip is active.
 */
export function MenuManagementScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierMenu'>>();
  const { merchantId, merchantName } = params;

  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [category, setCategory] = useState('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const chipRow = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      setItems(await listAllMenuItems(merchantId));
    } catch {
      setItems([]);
    }
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The filter row is built from the menu itself, so it never offers a
  // category with nothing behind it.
  const present = useMemo(() => orderCategories((items ?? []).map((i) => i.category)), [items]);
  const filters = useMemo(() => ['All', ...present], [present]);
  // A filter whose last dish was edited away falls back to All.
  const active = filters.find((f) => categoryKey(f) === categoryKey(category)) ?? 'All';

  const visible = useMemo(
    () =>
      (items ?? []).filter(
        (i) => active === 'All' || categoryKey(i.category) === categoryKey(active)
      ),
    [items, active]
  );

  // Keep the active chip in view — after a delete falls back to All, or an
  // added dish selects a chip further along.
  useEffect(() => {
    const x = chipX.current[active];
    if (x !== undefined) chipRow.current?.scrollTo({ x: Math.max(0, x - SCREEN_PADDING), animated: true });
  }, [active, filters]);

  // Pairs, so a lone last card keeps its half width instead of stretching.
  const rows = useMemo(() => {
    const out: MenuItem[][] = [];
    for (let i = 0; i < visible.length; i += 2) out.push(visible.slice(i, i + 2));
    return out;
  }, [visible]);

  const toggle = async (item: MenuItem) => {
    // Optimistic: the card should answer at once.
    setItems((prev) =>
      prev?.map((i) => (i.id === item.id ? { ...i, available: !i.available } : i)) ?? prev
    );
    try {
      await setMenuItemAvailable(merchantId, item.id, !item.available);
      showToast(item.available ? `${item.name} is now unavailable` : `${item.name} is available again`);
    } catch {
      showToast(`Could not update ${item.name}. Try again.`, { tone: 'error' });
      void load();
    }
  };

  const queryClient = useQueryClient();
  const onSaved = ({ kind, name, category: saved }: MenuSaveResult) => {
    void queryClient.invalidateQueries({ queryKey: ['food'] });
    setSheetOpen(false);
    showToast(kind === 'added' ? `${name} added to the menu` : kind === 'updated' ? `${name} saved` : `${name} deleted`);
    // Show the dish that was just added, whichever filter was on.
    if (kind === 'added') setCategory(saved || 'All');
    void load();
  };

  const openSheet = (item: MenuItem | null) => {
    setEditing(item);
    setSheetOpen(true);
  };

  return (
    <Screen>
      <SupplierPageHeader
        title="Menu Management"
        titleStyle={styles.title}
        bordered={false}
        subtitle={
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            Manage your{' '}
            <Text variant="body" color={colors.primary} style={styles.subtitleName}>
              {merchantName}
            </Text>{' '}
            menu in here.
          </Text>
        }
        onBack={() => navigation.goBack()}
        action={<SupplierHeaderAction label="Add Item" onPress={() => openSheet(null)} />}
      />

      {items && items.length > 0 ? (
        <View style={styles.filterRow}>
          <ScrollView
            ref={chipRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {filters.map((c) => {
              const on = c === active;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setCategory(c)}
                  onLayout={(e) => {
                    chipX.current[c] = e.nativeEvent.layout.x;
                  }}
                  style={[styles.filter, on && styles.filterOn]}
                >
                  <Text variant="label" color={on ? colors.onPrimary : colors.textSecondary}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items === null ? (
          <View style={styles.row}>
            <Skeleton height={208} style={styles.cell} />
            <Skeleton height={208} style={styles.cell} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="menuManagement"
            title="No dishes yet"
            message="Add your first dish and customers will be able to order it once the restaurant is open."
            actionLabel="Add your first dish"
            onAction={() => openSheet(null)}
          />
        ) : (
          rows.map((row) => (
            <View key={row.map((i) => i.id).join('|')} style={styles.row}>
              {row.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onToggle={() => void toggle(item)}
                  onEdit={() => openSheet(item)}
                />
              ))}
              {row.length === 1 ? <View style={styles.cell} /> : null}
            </View>
          ))
        )}
      </ScrollView>

      <AddMenuItemSheet
        visible={sheetOpen}
        merchantId={merchantId}
        merchantName={merchantName}
        item={editing}
        categories={present}
        initialCategory={active === 'All' ? undefined : active}
        onClose={() => setSheetOpen(false)}
        onSaved={onSaved}
      />
    </Screen>
  );
}

function MenuItemCard({
  item,
  onToggle,
  onEdit,
}: {
  item: MenuItem;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const off = !item.available;
  return (
    <View style={[styles.cell, styles.card]}>
      <View style={styles.photo}>
        <Image
          source={resolveImage(item.image)}
          style={[styles.image, off && styles.imageOff]}
          contentFit="cover"
          transition={120}
        />
        {off ? (
          <View style={styles.offBadge}>
            <Text variant="badge" color={colors.onPrimary}>
              Unavailable
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text variant="cardTitleTight" color={colors.text} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.tag}>
            <Text variant="micro" color={colors.textSecondary} numberOfLines={1}>
              {item.category || '—'}
            </Text>
          </View>
          <Text variant="priceLg" color={colors.primary}>
            {formatMoney(item.price)}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${off ? 'Make available' : 'Make unavailable'}: ${item.name}`}
            onPress={onToggle}
            style={({ pressed }) => [styles.availBtn, off && styles.availBtnOff, pressed && styles.pressed]}
          >
            <Text variant="labelSm" color={off ? colors.onPrimary : colors.primary} align="center">
              {off ? 'Make it available' : 'Make it unavailable'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={onEdit}
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          >
            <Icon name="pencilSm" size={13} color={colors.palette.gray700} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.pageTitle, marginTop: spacing[4] },
  subtitle: { fontFamily: fontFamily[400] },
  subtitleName: { fontFamily: fontFamily[700] },
  // The vertical padding lives on a wrapper: on web a horizontal ScrollView
  // sizes its content box without it and squeezes the chips upward.
  filterRow: { paddingTop: spacing[4], paddingBottom: spacing[3] },
  filters: { paddingHorizontal: SCREEN_PADDING, gap: spacing[3], alignItems: 'center' },
  filter: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  filterOn: { backgroundColor: colors.primary },
  // 12 under the filter container plus the grid's own 12 (176:2957).
  content: {
    paddingTop: spacing[9],
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  row: { flexDirection: 'row', gap: spacing[4] },
  cell: { flex: 1, minWidth: 0 },
  card: {
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 0.54,
    borderColor: colors.primaryOutline,
    overflow: 'hidden',
    ...shadows.menuCard,
  },
  photo: { height: 100, backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  imageOff: { opacity: 0.4 },
  offBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  cardBody: { paddingHorizontal: spacing[4], paddingTop: spacing[3.5], paddingBottom: spacing[4] },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[1.5],
    marginTop: spacing[0.5],
  },
  tag: {
    flexShrink: 1,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    borderRadius: radius.tag,
    backgroundColor: colors.surfaceAlt,
  },
  actions: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', marginTop: spacing[4] },
  availBtn: {
    flex: 1,
    minHeight: 34,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[1.5],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryOutlineSoft,
  },
  availBtnOff: { backgroundColor: colors.primary, borderColor: colors.primary },
  editBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.6 },
});
