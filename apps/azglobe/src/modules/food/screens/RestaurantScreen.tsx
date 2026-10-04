import { useMemo, useState, type ReactNode } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, EmptyState, Icon, Screen, showToast, Text } from '@core/ui';
import { Alert } from '@core/ui/alert';
import { Chip } from '@core/ui/Chip';
import { SectionHeader } from '@core/ui/SectionHeader';
import { SegmentedTabs } from '@core/ui/SegmentedTabs';
import { Skeleton } from '@core/ui/Skeleton';
import { colors, radius, SCREEN_PADDING, shadows, spacing } from '@core/theme';
import { isFirebaseReady } from '@core/firebase';
import { useSession } from '@app/providers/SessionProvider';
import { RestaurantHeader } from '../components/RestaurantHeader';
import { DEFAULT_LOOK, OfferCard } from '../components/OfferCard';
import { FoodCard } from '../components/FoodCard';
import { FoodCardSkeleton } from '../components/FoodCardSkeleton';
import { MenuItemRow } from '../components/MenuItemRow';
import { ReviewCard } from '../components/ReviewCard';
import { RatingSummary } from '../components/RatingSummary';
import { WriteReviewSheet } from '../components/WriteReviewSheet';
import { MapPreview } from '../components/MapPreview';
import { LoadErrorState } from '../components/LoadErrorState';
import { useActiveOffers, useMenu, useMerchant, useReviews, useSubmitReview } from '../hooks/queries';
import { findReviewableOrderId } from '../services/reviews';
import { useAddToCart } from '../hooks/useAddToCart';
import { formatDayMonth } from '@core/utils/datetime';
import { discountLabel, offerHeadline } from '../services/promotions';
import { listMyOrders } from '../services/orders';
import { closedLabel, dayHoursLabel, hoursSummary, nextOpeningLabel, sameEveryDay, todayKey, WEEK } from '../utils/hours';
import type { FoodStackParamList } from '../navigation/types';
import type { MenuItem, Merchant, MerchantFeature, Review } from '../types';
import { deliveryTermsLine } from '../utils/deliveryLabels';
import { formatMoney } from '@core/utils/currency';

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
 * below changes. The offer banner stays above Menu, Reviews and Info;
 * a closed restaurant shows a "Closed · opens 7:00 AM" strip there instead and
 * its dishes cannot be added.
 */
export function RestaurantScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'Restaurant'>>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'menu');

  const { data: merchant, isSuccess, isError, refetch } = useMerchant(params.merchantId);
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('FoodLanding'));

  if (isError && !merchant) {
    return (
      <LoadErrorState
        title="Couldn't load this restaurant"
        message="Check your connection and try again."
        onBack={goBack}
        onRetry={() => void refetch()}
      />
    );
  }

  // A settled read that found nothing — not a slow or paused one.
  if (isSuccess && !merchant) {
    return (
      <LoadErrorState
        title="Restaurant not found"
        message="It may have closed down or moved. Try another place nearby."
        onBack={goBack}
      />
    );
  }

  if (!merchant) {
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
        <RestaurantHeader merchant={merchant} onBack={goBack} />

        {!merchant.isOpen ? (
          <ClosedBanner merchant={merchant} />
        ) : (
          <RestaurantOffer merchant={merchant} />
        )}

        <View style={styles.tabsWrap}>
          <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
        </View>

        {tab === 'menu' ? <MenuTab merchant={merchant} /> : null}
        {tab === 'reviews' ? <ReviewsTab merchant={merchant} /> : null}
        {tab === 'info' ? <InfoTab merchant={merchant} /> : null}
      </ScrollView>
    </Screen>
  );
}

// ── Closed / offer strip ───────────────────────────────────────────────────

/** A closed restaurant can be browsed but not ordered from. */
function ClosedBanner({ merchant }: { merchant: Merchant }) {
  return (
    <View style={styles.closedWrap}>
      <View style={styles.closed} accessibilityRole="alert">
        <View style={styles.closedIcon}>
          <Icon name="clock" size={16} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="labelLg" color={colors.textStrong}>
            {closedLabel(merchant.hours)}
          </Text>
          <Text variant="bodySm" color={colors.textSecondary}>
            {nextOpeningLabel(merchant.hours)
              ? 'Browse the menu now and order once it opens.'
              : 'It isn’t taking orders at the moment. You can still browse the menu.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The restaurant's running offer, above the tabs where Figma puts its banner
 * (17:4787), drawn as the card the restaurant designed on "Customize Look"
 * (370:3714). Only a real, running promotion shows — the one the cart will
 * actually apply — so no restaurant advertises a discount it does not give.
 */
function RestaurantOffer({ merchant }: { merchant: Merchant }) {
  const navigation = useNavigation<Nav>();
  const { data: offers } = useActiveOffers(merchant.id);
  const offer = offers?.[0];
  // An offer on some dishes opens on exactly those; one on everything, the whole menu.
  const openMenu = () =>
    navigation.navigate('MenuAll', { merchantId: merchant.id, offers: offer?.appliesTo === 'items' });

  if (!offer) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={offerHeadline(offer)}
      onPress={openMenu}
      style={styles.bannerWrap}
    >
      <OfferCard look={offer.look ?? DEFAULT_LOOK} headline={offerHeadline(offer, { withDate: false })} subtitle={`Until ${formatDayMonth(offer.validUntil)}`} badge={discountLabel(offer)} />
    </Pressable>
  );
}

// ── Menu ───────────────────────────────────────────────────────────────────
function MenuTab({ merchant }: { merchant: Merchant }) {
  const navigation = useNavigation<Nav>();
  const addToCart = useAddToCart();
  const { data, isLoading, isError, refetch } = useMenu(merchant.id);
  const [picked, setPicked] = useState<string | null>(null);
  const closed = !merchant.isOpen;

  const items = useMemo(() => data ?? [], [data]);
  // Figma's chips start at "Popular"; after that, categories in menu order.
  // Only categories that have dishes get a chip, so none can open empty.
  const categories = useMemo(() => {
    const seen = [...new Set(items.map((i) => i.category))];
    return seen.includes('Popular') ? ['Popular', ...seen.filter((c) => c !== 'Popular')] : seen;
  }, [items]);
  const category = picked && categories.includes(picked) ? picked : categories[0];

  const gridItems = items.filter((i) => i.category === category).slice(0, 4);
  const rows: MenuItem[][] = [];
  for (let i = 0; i < gridItems.length; i += 2) rows.push(gridItems.slice(i, i + 2));

  const openItem = (item: MenuItem) =>
    navigation.navigate('ItemDetail', { merchantId: merchant.id, menuItemId: item.id });
  const add = (item: MenuItem) => {
    if (closed) {
      showToast(`${merchant.name} is closed right now`, { tone: 'error' });
      return;
    }
    addToCart(item);
  };

  if (isLoading) {
    return (
      <View style={styles.menuLoading}>
        <View style={styles.gridRow}>
          <FoodCardSkeleton />
          <FoodCardSkeleton />
        </View>
      </View>
    );
  }

  if (isError && !items.length) {
    return (
      <EmptyState
        icon="warning"
        title="Couldn't load the menu"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon="utensils"
        title="No dishes yet"
        message={`${merchant.name} hasn't added its menu yet. Check back soon.`}
      />
    );
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categories.map((c) => (
          <Chip key={c} label={c} selected={c === category} onPress={() => setPicked(c)} />
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {rows.map((pair, i) => (
          <View key={i} style={styles.gridRow}>
            {pair.map((item) => (
              <FoodCard
                key={item.id}
                item={item}
                showMerchant={false}
                addDisabled={closed}
                onPress={() => openItem(item)}
                onAdd={() => add(item)}
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
          onSeeAll={() => navigation.navigate('MenuAll', { merchantId: merchant.id })}
        />
        <View>
          {items.slice(0, 6).map((item, i, arr) => (
            <MenuItemRow
              key={item.id}
              item={item}
              addDisabled={closed}
              showDivider={i < arr.length - 1}
              onPress={() => openItem(item)}
              onAdd={() => add(item)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

// ── Reviews ────────────────────────────────────────────────────────────────

/** Share of reviews at each star level, 5 → 1, from the reviews themselves. */
function breakdownOf(reviews: Review[]) {
  const counts = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const stars = Math.min(5, Math.max(1, Math.round(r.rating)));
    counts[stars - 1]! += 1;
  }
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    percent: total ? Math.round((counts[stars - 1]! / total) * 100) : 0,
  }));
}

function ReviewsTab({ merchant }: { merchant: Merchant }) {
  const { data, isLoading, isError, refetch } = useReviews(merchant.id);
  const submitReview = useSubmitReview();
  const { user } = useSession();
  const [writing, setWriting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [context, setContext] = useState<{ orderId?: string; dishTag?: string }>({});

  const reviews = data ?? [];
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  // The merchant document carries the full tally; the list is the newest page
  // of it. Fall back to the list when the tally has not caught up yet.
  const count = Math.max(merchant.reviewCount, reviews.length);
  const rating = merchant.reviewCount >= reviews.length && merchant.rating > 0 ? merchant.rating : average;

  /**
   * firestore.rules accept a review only against one of the customer's
   * delivered orders at this restaurant, so look for one BEFORE the customer
   * types anything. Demo mode has no such rule, but a delivered order still
   * lends its first dish as the review's tag.
   */
  const startReview = async () => {
    setChecking(true);
    let delivered: Awaited<ReturnType<typeof listMyOrders>>[number] | undefined;
    let lookedUp = true;
    try {
      const orders = await listMyOrders();
      delivered = orders.find((o) => o.merchantId === merchant.id && o.status === 'delivered');
    } catch {
      // Could not check (offline?) — let the save itself decide.
      lookedUp = false;
    }
    // The list above is the customer's newest orders only; an older delivery
    // from this restaurant still counts, so ask for one directly.
    let olderOrderId: string | null = null;
    if (!delivered && lookedUp && isFirebaseReady()) {
      try {
        olderOrderId = await findReviewableOrderId(merchant.id);
      } catch {
        lookedUp = false;
      }
    }
    setChecking(false);

    if (!delivered && !olderOrderId && lookedUp && isFirebaseReady()) {
      Alert.alert(
        'Order first, then review',
        `Reviews come from customers who've eaten here. You can review ${merchant.name} once one of your orders from them has been delivered.`
      );
      return;
    }
    setContext({ orderId: delivered?.id ?? olderOrderId ?? undefined, dishTag: delivered?.items[0]?.name });
    setWriting(true);
  };

  const submit = async (stars: number, text: string) => {
    try {
      await submitReview.mutateAsync({
        merchantId: merchant.id,
        rating: stars,
        text,
        ...(user.fullName.trim() ? { userName: user.fullName.trim() } : {}),
        ...(context.dishTag ? { dishTag: context.dishTag } : {}),
        ...(context.orderId ? { orderId: context.orderId } : {}),
      });
      showToast('Thanks for your review');
    } catch (error) {
      // services/reviews.ts words its own refusals for customers ("…once an
      // order from it has been delivered", "Sign in to…"); anything else is
      // a transport error and gets a plain retry message.
      const message = error instanceof Error ? error.message : '';
      showToast(
        /delivered|sign in|rating|characters|restaurant/i.test(message)
          ? message
          : 'Could not post your review. Check your connection and try again.',
        { tone: 'error' }
      );
      throw error;
    }
  };

  return (
    <View style={styles.reviews}>
      {reviews.length ? <RatingSummary rating={rating} reviewCount={count} breakdown={breakdownOf(reviews)} /> : null}

      {/* Figma draws this as a dashed outline button. */}
      <Pressable
        accessibilityRole="button"
        disabled={checking}
        onPress={startReview}
        style={({ pressed }) => [styles.writeReview, (pressed || checking) && styles.pressed]}
      >
        <Icon name="pencil" size={14} color={colors.textSecondary} />
        <Text variant="labelLg" color={colors.textSecondary}>
          {checking ? 'Checking your orders…' : 'Write a Review'}
        </Text>
      </Pressable>

      {isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={150} borderRadius={radius['3xl']} />)
      ) : isError ? (
        <EmptyState
          icon="warning"
          title="Couldn't load reviews"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      ) : reviews.length ? (
        reviews.map((r) => <ReviewCard key={r.id} review={r} merchantName={merchant.name} />)
      ) : (
        <EmptyState
          icon="reviews"
          title="No reviews yet"
          message={`Be the first to tell others how ${merchant.name} was.`}
        />
      )}

      <WriteReviewSheet
        visible={writing}
        merchantName={merchant.name}
        onClose={() => setWriting(false)}
        onSubmit={submit}
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

/** Opens the platform's maps app with directions to the restaurant. */
function openDirections(merchant: Merchant) {
  const destination = merchant.geo
    ? `${merchant.geo.lat},${merchant.geo.lng}`
    : encodeURIComponent(merchant.address);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destination}`
      : Platform.OS === 'android'
        ? `geo:0,0?q=${merchant.geo ? destination : encodeURIComponent(merchant.address)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.address)}`)
  );
}

async function shareRestaurant(merchant: Merchant) {
  const message = [merchant.name, merchant.tagline, merchant.address, merchant.phone]
    .filter(Boolean)
    .join('\n');
  // Browsers without the Web Share API (most desktop ones) get the details
  // copied instead of an error.
  const nav = (globalThis as { navigator?: Navigator }).navigator;
  if (Platform.OS === 'web' && !nav?.share) {
    try {
      await nav?.clipboard?.writeText(message);
      showToast('Restaurant details copied');
    } catch {
      showToast('Sharing isn’t available in this browser', { tone: 'error' });
    }
    return;
  }
  try {
    await Share.share({ title: merchant.name, message });
  } catch (error) {
    // Dismissing the share sheet is not a failure.
    if ((error as { name?: string } | null)?.name === 'AbortError') return;
    showToast('Could not open sharing', { tone: 'error' });
  }
}

function InfoTab({ merchant }: { merchant: Merchant }) {
  const [weekOpen, setWeekOpen] = useState(false);
  const varies = Boolean(merchant.hours) && !sameEveryDay(merchant.hours);
  const today = todayKey();

  return (
    <View style={styles.info}>
      <View>
        <InfoRow icon="mapPin" label="Address" value={merchant.address} />
        <InfoRow
          icon="clock"
          label="Hours"
          value={hoursSummary(merchant.hours)}
          onPress={varies ? () => setWeekOpen((v) => !v) : undefined}
          expanded={weekOpen}
        >
          {varies && weekOpen ? (
            <View style={styles.week}>
              {WEEK.map((d) => (
                <View key={d.key} style={styles.weekRow}>
                  <Text
                    variant={d.key === today ? 'label' : 'bodyRegular'}
                    color={d.key === today ? colors.textStrong : colors.textSecondary}
                  >
                    {d.label}
                  </Text>
                  <Text
                    variant={d.key === today ? 'label' : 'bodyRegular'}
                    color={d.key === today ? colors.textStrong : colors.textSecondary}
                  >
                    {dayHoursLabel(merchant.hours[d.key])}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </InfoRow>
        <InfoRow icon="phone" label="Phone" value={merchant.phone} />
      </View>

      <View style={styles.infoActions}>
        <Button
          label="Call Now"
          leadingIcon={<Icon name="phone" size={15} color={colors.onPrimary} />}
          onPress={() => Linking.openURL(`tel:${merchant.phone.replace(/\s/g, '')}`)}
          style={styles.flex}
        />
        <Button
          label="Share"
          variant="secondary"
          leadingIcon={<Icon name="share" size={15} color="#364153" />}
          onPress={() => void shareRestaurant(merchant)}
          style={styles.flex}
        />
      </View>

      {/* Location — Figma 18:5218: pin + "Location" in brand red, the map with
          a Directions pill, then the address under it. */}
      <View style={styles.locationCard}>
        <View style={styles.locationHead}>
          <Icon name="mapPin" size={17} color={colors.primary} />
          <Text variant="body" color={colors.primary}>
            Location
          </Text>
        </View>
        <MapPreview height={180} style={styles.map} onDirections={() => openDirections(merchant)} />
        <Text variant="labelMd" color={colors.textHeading} style={styles.locationAddress}>
          {merchant.address}
        </Text>
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

      {deliveryTermsLine(merchant) ? (
        <View style={styles.aboutCard}>
          <Text variant="h4" color={colors.textStrong}>
            Delivery
          </Text>
          <View style={styles.feature}>
            <Icon name="bike" size={14} color={colors.primary} />
            <Text variant="bodySm" color={colors.text} style={styles.flexText}>
              {deliveryTermsLine(merchant)}
            </Text>
          </View>
          {merchant.freeDeliveryOver ? (
            <Text variant="bodySm" color={colors.textSecondary}>
              Free delivery on orders over {formatMoney(merchant.freeDeliveryOver)}.
            </Text>
          ) : null}
        </View>
      ) : null}

      {merchant.features.length ? (
        <View style={styles.aboutCard}>
          <Text variant="h4" color={colors.textStrong}>
            Features
          </Text>
          <View style={styles.featureGrid}>
            {merchant.features.map((f) => (
              <View key={f} style={styles.feature}>
                <Icon name="checkSm" size={14} color={colors.success} />
                <Text variant="bodySm" color={colors.text}>
                  {FEATURE_LABELS[f]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Figma 18:5218: row gap 12 · pad 12/0 · icon 16 centred · label 400 12/18 #9CA3AF · value 600 14/21. */
function InfoRow({
  icon,
  label,
  value,
  onPress,
  expanded,
  children,
}: {
  icon: 'mapPin' | 'clock' | 'phone';
  label: string;
  value: string;
  onPress?: () => void;
  expanded?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <View style={styles.infoRow}>
      <Icon name={icon} size={16} color={colors.textMuted} />
      <View style={styles.flex}>
        <Text variant="bodyRegular" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="labelLg" color={colors.text}>
          {value}
        </Text>
      </View>
      {onPress ? (
        <View style={expanded ? styles.chevronUp : styles.chevronDown}>
          <Icon name="chevronRight" size={14} color={colors.textMuted} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.infoRowWrap}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint="Shows the hours for every day"
          onPress={onPress}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flexText: { flex: 1 },
  content: { paddingBottom: spacing[12] },
  loading: { padding: SCREEN_PADDING, gap: spacing[4] },

  tabsWrap: { paddingTop: spacing[1] },

  // Figma 17:4787: the banner block is pad 12/20 above the tab bar.
  bannerWrap: { paddingHorizontal: spacing[8], paddingVertical: spacing[4] },

  closedWrap: { paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing[3] },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radius['3xl'],
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryOutline,
  },
  closedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  chipRow: { gap: spacing[3], paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing[4] },

  menuLoading: { padding: SCREEN_PADDING },
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

  // Figma 18:5218: pad 20/16, sections 16 apart.
  info: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[8], paddingBottom: spacing[6], gap: spacing[6] },
  infoRowWrap: { borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: spacing[4] },
  chevronDown: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },
  week: { paddingLeft: 16 + spacing[4], paddingBottom: spacing[4], gap: spacing[1.5] },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoActions: { flexDirection: 'row', gap: spacing[4] },

  locationCard: {
    gap: spacing[2.5],
    padding: spacing[6],
    borderRadius: radius['3xl'],
    borderWidth: 0.54,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  locationHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  map: { borderRadius: radius['3xl'] },
  locationAddress: { paddingTop: spacing[2.5] },

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
  pressed: { opacity: 0.7 },
});
