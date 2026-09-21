import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, ScreenHeader, Skeleton, Text } from '@core/ui';
import type { MenuItem } from '@modules/food/types';
import { resolveImage } from '@modules/food/data/images';
import { formatMoney } from '@core/utils/currency';
import type { RootStackParamList } from '@app/navigation/types';
import { AddMenuItemSheet } from './AddMenuItemSheet';
import { deleteMenuItem, listAllMenuItems, setMenuItemAvailable } from '../services/menu';

/**
 * Menu management — Figma 176:2923.
 *
 *   filter row  category chips; "All" selected, #D42B2B fill, Urbanist 600 12/18
 *   grid        2 columns of MenuItemCard 174.73x207.87 · r16 · #FFFFFF ·
 *               0.54px #D42B2B@15% border · shadow 0 2 8 #D42B2B@7%
 *   card        image 100h · name Urbanist 700 13/16.25 · category pill on
 *               #F3F4F6 r6 · price Urbanist 800 14/21 #D42B2B ·
 *               "Make it unavailable" on #FFF1F0 r10 · 32pt delete on #F3F4F6
 *
 * This screen is where a restaurant's menu comes from. Nothing is seeded, so a
 * dish exists only because the supplier added it here.
 */
export function MenuManagementScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierMenu'>>();
  const { merchantId, merchantName } = params;

  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [category, setCategory] = useState('All');
  const [adding, setAdding] = useState(false);

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

  // The filter row is built from the menu itself, so it never offers a category
  // with nothing behind it.
  const categories = useMemo(() => {
    const present = [...new Set((items ?? []).map((i) => i.category).filter(Boolean))].sort();
    return ['All', ...present];
  }, [items]);

  const visible = useMemo(
    () => (items ?? []).filter((i) => category === 'All' || i.category === category),
    [items, category]
  );

  return (
    <Screen>
      <ScreenHeader
        title="Menu"
        subtitle={merchantName}
        onBack={() => navigation.goBack()}
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => setAdding(true)}
            style={styles.addBtn}
          >
            <Icon name="plusSm" size={14} color={colors.onPrimary} />
            <Text variant="bodySm" color={colors.onPrimary}>
              Add Item
            </Text>
          </Pressable>
        }
      />

      {items && items.length > 0 ? (
        <ScrollView
          horizontal
          style={styles.filterRow}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {categories.map((c) => {
            const on = c === category;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setCategory(c)}
                style={[styles.filter, on && styles.filterOn]}
              >
                <Text variant="bodySm" color={on ? colors.onPrimary : colors.textSecondary}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items === null ? (
          <View style={styles.grid}>
            <Skeleton height={208} style={styles.cell} />
            <Skeleton height={208} style={styles.cell} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            title="No dishes yet"
            message="Add your first dish and customers will be able to order it."
          />
        ) : (
          <View style={styles.grid}>
            {visible.map((item) => (
              <View key={item.id} style={[styles.card, !item.available && styles.cardOff]}>
                <Image
                  source={resolveImage(item.image)}
                  style={styles.image}
                  contentFit="cover"
                  transition={120}
                />
                <View style={styles.cardBody}>
                  <Text variant="cardTitle" color={colors.text} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.categoryPill}>
                      <Text variant="micro" color={colors.textSecondary}>
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
                      onPress={async () => {
                        // Optimistic: the card should answer at once.
                        setItems((prev) =>
                          prev
                            ? prev.map((i) =>
                                i.id === item.id ? { ...i, available: !i.available } : i
                              )
                            : prev
                        );
                        try {
                          await setMenuItemAvailable(merchantId, item.id, !item.available);
                        } catch {
                          void load();
                        }
                      }}
                      style={styles.availBtn}
                    >
                      <Text variant="labelSm" color={colors.primary} align="center">
                        {item.available ? 'Make it unavailable' : 'Make it available'}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.name}`}
                      onPress={async () => {
                        setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
                        try {
                          await deleteMenuItem(merchantId, item.id);
                        } catch {
                          void load();
                        }
                      }}
                      style={styles.deleteBtn}
                    >
                      <Icon name="trash" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AddMenuItemSheet
        visible={adding}
        merchantId={merchantId}
        merchantName={merchantName}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          void load();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  // alignItems keeps each pill its natural height: a horizontal ScrollView
  // stretches children across the cross axis, which made them full-height bars.
  filterRow: { flexGrow: 0 },
  filters: {
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing[3],
    paddingBottom: spacing[4],
    alignItems: 'center',
  },
  filter: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  filterOn: { backgroundColor: colors.primary },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[12] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
  cell: { flexGrow: 1, flexBasis: '46%' },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radius['3xl'],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(212,43,43,0.15)',
    boxShadow: '0px 2px 8px 0px rgba(212,43,43,0.07)',
    overflow: 'hidden',
  },
  cardOff: { opacity: 0.55 },
  image: { width: '100%', height: 100, backgroundColor: colors.surfaceAlt },
  cardBody: { paddingHorizontal: spacing[4], paddingTop: spacing[3.5], paddingBottom: spacing[4] },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[0.5],
  },
  categoryPill: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  actions: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', marginTop: spacing[4] },
  availBtn: {
    flex: 1,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: 'rgba(212,43,43,0.07)',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
});
