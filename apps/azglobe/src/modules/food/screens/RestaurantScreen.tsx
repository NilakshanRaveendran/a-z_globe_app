import { useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Screen, Text } from '@core/ui';
import { Chip } from '@core/ui/Chip';
import { SectionHeader } from '@core/ui/SectionHeader';
import { SegmentedTabs } from '@core/ui/SegmentedTabs';
import { Skeleton } from '@core/ui/Skeleton';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { formatMoney } from '@core/utils/currency';
import { RestaurantHeader } from '../components/RestaurantHeader';
import { OfferBanner } from '../components/OfferBanner';
import { FoodCard } from '../components/FoodCard';
import { MenuItemRow } from '../components/MenuItemRow';
import { ReviewCard } from '../components/ReviewCard';
import { RatingSummary } from '../components/RatingSummary';
import { WriteReviewSheet } from '../components/WriteReviewSheet';
import { useMenu, useMerchant, useReviews } from '../hooks/queries';
import { ratingBreakdown } from '../data/fixtures';
import { useCart } from '../store/cart';
import type { FoodStackParamList } from '../navigation/types';
import type { MenuItem, MerchantFeature } from '../types';
import { useQuery } from '@tanstack/react-query';
import { isFirebaseReady } from '@core/firebase';
import { DEFAULT_LOOK, OfferCard } from '../components/OfferCard';
import { discountLabel, listActiveOffers, offerHeadline } from '../services/promotions';
import { activeOffersKey } from '../hooks/useAppliedPromotion';

type Nav = NativeStackNavigationProp<FoodStackParamList>;
type Tab = 'menu' | 'reviews' | 'info';

const TABS = [
  { key: 'menu' as const, label: 'Menu' },
  { key: 'reviews' as const, label: 'Reviews' },
  { key: 'info' as const, label: 'Info' },
];

/**
 * Restaurant page — Figma 17:4787 (Menu), 18:5057 (Reviews), 18:5218 (Info).
 *
 * All three tabs share the hero, title block and tab bar; only the content
 * below changes, which is exactly how the design is structured.
 */
export function RestaurantScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'Restaurant'>>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'menu');

  const { data: merchant, isLoading } = useMerchant(params.merchantId);

  if (isLoading || !merchant) {
    return (
      <Screen edges={[]}>
        <Skeleton height={282} borderRadius={0} />
        <View style={styles.loading}>
          <Skeleton width="55%" height={28} />
          <Skeleton width="40%" height={18} />
          <Skeleton height={154} borderRadius={radius['5xl']} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <RestaurantHeader merchant={merchant} onBack={navigation.goBack} />

        <View style={styles.tabsWrap}>
          <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
        </View>

        {tab === 'menu' ? <MenuTab merchantId={merchant.id} offerLabel={merchant.offerLabel} /> : null}
        {tab === 'reviews' ? (
          <ReviewsTab
            merchantId={merchant.id}
            merchantName={merchant.name}
            rating={merchant.rating}
            reviewCount={merchant.reviewCount}
          />
        ) : null}
        {tab === 'info' ? <InfoTab merchant={merchant} /> : null}
      </ScrollView>
    </Screen>
  );
}

// ── Menu ───────────────────────────────────────────────────────────────────
function MenuTab({ merchantId, offerLabel }: { merchantId: string; offerLabel?: string }) {
  const navigation = useNavigation<Nav>();
  const [category, setCategory] = useState('Popular');
  const { data, isLoading } = useMenu(merchantId);
  const addLine = useCart((s) => s.addFromMenuItem);
  const { data: offers } = useQuery({
    queryKey: activeOffersKey(merchantId),
    queryFn: () => listActiveOffers(merchantId),
    staleTime: 60_000,
  });
  const offer = offers?.[0];

  const items = data ?? [];
  const categories = useMemo(() => {
    const seen = items.map((i) => i.category);
    return ['Popular', ...new Set(seen.filter((c) => c !== 'Popular'))];
  }, [items]);

  const gridItems = items.filter((i) => i.category === category).slice(0, 4);
  const rows: MenuItem[][] = [];
  for (let i = 0; i < gridItems.length; i += 2) rows.push(gridItems.slice(i, i + 2));

  const openItem = (item: MenuItem) =>
    navigation.navigate('ItemDetail', { merchantId, menuItemId: item.id });

  return (
    <>
      {offer ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={offerHeadline(offer)}
          onPress={() => navigation.navigate('MenuAll', { merchantId })}
          style={styles.bannerWrap}
        >
          <OfferCard look={offer.look ?? DEFAULT_LOOK} headline={offerHeadline(offer)} badge={discountLabel(offer)} />
        </Pressable>
      ) : !isFirebaseReady() && offerLabel ? (
        // Design mode only: the Figma banner (17:4787) over the fixture data.
        // With a real project the card above shows the restaurant's own offer —
        // never a made-up discount.
        <View style={styles.bannerWrap}>
          <OfferBanner
            title={'20% off on your\nfirst meal 🎉'}
            onPress={() => navigation.navigate('MenuAll', { merchantId })}
          />
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categories.map((c) => (
          <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {isLoading
          ? null
          : rows.map((pair, i) => (
              <View key={i} style={styles.gridRow}>
                {pair.map((item) => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    showMerchant={false}
                    onPress={() => openItem(item)}
                    onAdd={() => addLine(item)}
                  />
                ))}
                {pair.length === 1 ? <View style={styles.flex} /> : null}
              </View>
            ))}
      </View>

      <View style={styles.quickAdd}>
        <SectionHeader
          title="Quick Add"
          size="md"
          onSeeAll={() => navigation.navigate('MenuAll', { merchantId })}
        />
        <View>
          {items.slice(0, 6).map((item, i, arr) => (
            <MenuItemRow
              key={`${item.id}-${i}`}
              item={item}
              showDivider={i < arr.length - 1}
              onPress={() => openItem(item)}
              onAdd={() => addLine(item)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

// ── Reviews ────────────────────────────────────────────────────────────────
function ReviewsTab({
  merchantId,
  merchantName,
  rating,
  reviewCount,
}: {
  merchantId: string;
  merchantName: string;
  rating: number;
  reviewCount: number;
}) {
  const { data, isLoading } = useReviews(merchantId);
  const [writing, setWriting] = useState(false);

  return (
    <View style={styles.reviews}>
      <RatingSummary rating={rating} reviewCount={reviewCount} breakdown={ratingBreakdown} />

      {/* Figma draws this as a dashed outline button. */}
      <Pressable
        onPress={() => setWriting(true)}
        style={({ pressed }) => [styles.writeReview, pressed && styles.pressed]}
      >
        <Icon name="pencil" size={14} color={colors.textSecondary} />
        <Text variant="labelLg" color={colors.textSecondary}>
          Write a Review
        </Text>
      </Pressable>

      {isLoading
        ? [0, 1, 2].map((i) => <Skeleton key={i} height={150} borderRadius={radius['3xl']} />)
        : (data ?? []).map((r) => <ReviewCard key={r.id} review={r} />)}

      <WriteReviewSheet
        visible={writing}
        merchantName={merchantName}
        onClose={() => setWriting(false)}
        // Reviews are written to Firestore (guarded by firestore.rules) once
        // auth is wired; the sheet itself is complete either way.
        onSubmit={() => setWriting(false)}
      />
    </View>
  );
}

// ── Info ───────────────────────────────────────────────────────────────────
const FEATURE_LABELS: Record<MerchantFeature, string> = {
  dineIn: 'Dine-in available',
  takeaway: 'Takeaway',
  homeDelivery: 'Home delivery',
  cards: 'Accepts cards',
  wifi: 'Free Wi-Fi',
  familyFriendly: 'Family-friendly',
};

function InfoTab({ merchant }: { merchant: import('../types').Merchant }) {
  const hours = merchant.hours.mon;

  return (
    <View style={styles.info}>
      <View style={styles.infoList}>
        <InfoRow icon="mapPin" label="Address" value={merchant.address} />
        <InfoRow icon="clock" label="Hours" value={`${hours.open} – ${hours.close}, Daily`} />
        <InfoRow icon="phone" label="Phone" value={merchant.phone} />
        <InfoRow
          icon="bike"
          label="Delivery"
          value={`${formatMoney(merchant.deliveryFee)} delivery fee`}
          last
        />
      </View>

      <View style={styles.infoActions}>
        <Button
          label="Call Now"
          leadingIcon={<Icon name="phone" size={16} color={colors.onPrimary} />}
          onPress={() => Linking.openURL(`tel:${merchant.phone.replace(/\s/g, '')}`)}
          style={styles.flex}
        />
        <Button
          label="Share"
          variant="secondary"
          leadingIcon={<Icon name="share" size={16} color="#364153" />}
          onPress={() => {}}
          style={styles.flex}
        />
      </View>

      {merchant.about ? (
        <View style={styles.aboutCard}>
          <Text variant="h4" color={colors.textStrong}>
            About
          </Text>
          <Text variant="body" color={colors.palette.gray700} style={styles.aboutBody}>
            {merchant.about}
          </Text>
          <View style={styles.tagRow}>
            {merchant.cuisines.map((c) => (
              <View key={c} style={styles.tag}>
                <Text variant="bodySm" color={colors.textSecondary}>
                  {c}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.aboutCard}>
        <Text variant="h4" color={colors.textStrong}>
          Features
        </Text>
        <View style={styles.featureGrid}>
          {merchant.features.map((f) => (
            <View key={f} style={styles.feature}>
              <Text variant="bodySm" color={colors.success}>
                ✓
              </Text>
              <Text variant="bodySm" color={colors.text}>
                {FEATURE_LABELS[f]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: 'mapPin' | 'clock' | 'phone' | 'bike';
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowDivider]}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <View style={styles.flex}>
        <Text variant="bodySm" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="bodyLg" color={colors.textStrong} style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing[12] },
  loading: { padding: SCREEN_PADDING, gap: spacing[4] },

  tabsWrap: { paddingTop: spacing[4] },

  bannerWrap: { paddingHorizontal: spacing[8], paddingVertical: spacing[4] },
  chipRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing[4] },

  grid: { paddingHorizontal: SCREEN_PADDING, gap: spacing[4] },
  gridRow: { flexDirection: 'row', gap: spacing[4] },

  quickAdd: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[9] },

  reviews: { padding: SCREEN_PADDING, gap: spacing[4] },
  writeReview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[6],
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },

  info: { padding: SCREEN_PADDING, gap: spacing[6] },
  infoList: {},
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4], paddingVertical: spacing[5] },
  infoRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoValue: { fontFamily: 'Urbanist_600SemiBold' },
  infoActions: { flexDirection: 'row', gap: spacing[4] },

  aboutCard: {
    gap: spacing[3],
    padding: spacing[6],
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  aboutBody: { lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2.5], paddingTop: spacing[1.5] },
  tag: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing[3], paddingTop: spacing[1.5] },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], width: '50%' },

  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
});
