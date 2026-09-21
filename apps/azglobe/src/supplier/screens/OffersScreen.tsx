import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, fontFamily, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, Text } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import type { Promotion } from '@modules/food/types';
import { DEFAULT_LOOK, OfferCard } from '@modules/food/components/OfferCard';
import { discountLabel, offerHeadline, scopeLabel } from '@modules/food/services/promotions';
import type { RootStackParamList } from '@app/navigation/types';
import { deleteOffer, listOffers, setOfferActive } from '../services/offers';
import { SupplierHeader } from '../components/SupplierHeader';
import { OfferEditorSheet } from './OfferEditorSheet';

/**
 * Offers & Discounts — Figma 352:6743.
 *
 *   create   56h r14 #D42B2B · 18pt plus-circle · "Create New Offer Card" 700 15
 *   section  "ACTIVE" / "INACTIVE" 700 11/16.5 ls0.55 #9CA3AF + hairline, 20 above
 *   card     r16 · 0.5pt #E5E7EB · shadow 0 1 3 7% · the compact OfferCard in
 *            pad 12 · discount pill #FFF0F0, 0.5pt #D42B2B@15%, 800 11 #D42B2B
 *            + "on All items" 400 11 #6B7280 · footer pad 10/12: status pill
 *            (Active #F0FDF4/#16A34A, Inactive #F3F4F6/#9CA3AF, 4pt dot, 500 10)
 *            "34 used" 500 11 #6B7280 · "· Min Rs. 500" 400 10 #9CA3AF ·
 *            40×22 toggle · 30pt edit and ⋮ buttons · inactive cards at 70%
 *
 * A running offer is what customers see on this restaurant and get at checkout
 * automatically; an inactive or expired one does nothing.
 */
export function OffersScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierOffers'>>();
  const { merchantId, merchantName } = params;

  const [offers, setOffers] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setOffers(await listOffers(merchantId));
    } catch {
      setError('Could not load your offers. Pull down to try again.');
      setOffers([]);
    }
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const running = (p: Promotion) => p.active !== false && p.validUntil > now;
  const active = (offers ?? []).filter(running);
  const inactive = (offers ?? []).filter((p) => !running(p));

  const toggle = async (offer: Promotion) => {
    if (offer.validUntil <= now) {
      Alert.alert('This offer has ended', 'Edit it and choose a new "Valid Until" date to run it again.');
      return;
    }
    setPending(offer.id);
    try {
      await setOfferActive(offer, offer.active === false);
      await load();
    } catch {
      Alert.alert('Could not update the offer', 'Check your connection and try again.');
    } finally {
      setPending(null);
    }
  };

  const more = (offer: Promotion) =>
    Alert.alert(discountLabel(offer), offerHeadline(offer), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete offer',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete this offer?', 'Customers will stop seeing it. This cannot be undone.', [
            { text: 'Keep', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                setPending(offer.id);
                try {
                  await deleteOffer(offer);
                  await load();
                } catch {
                  Alert.alert('Could not delete the offer', 'Check your connection and try again.');
                } finally {
                  setPending(null);
                }
              },
            },
          ]),
      },
    ]);

  const openEditor = (offer: Promotion | null) => {
    setEditing(offer);
    setEditorOpen(true);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.headerBleed}>
          <SupplierHeader title="Offers & Discounts" subtitle={merchantName} onBack={() => navigation.goBack()} />
        </View>

        <Pressable accessibilityRole="button" onPress={() => openEditor(null)} style={styles.create}>
          <Icon name="plusCircle" size={18} color={colors.onPrimary} />
          <Text variant="h4" color={colors.onPrimary}>
            Create New Offer Card
          </Text>
        </Pressable>

        {offers === null ? (
          <View style={styles.section}>
            <Skeleton height={165} borderRadius={radius['3xl']} />
          </View>
        ) : offers.length === 0 ? (
          <View style={styles.section}>
            <EmptyState
              title={error ? 'Something went wrong' : 'No offers yet'}
              message={
                error ??
                'Create an offer card and switch it on — customers see it on your restaurant and get the discount at checkout automatically.'
              }
            />
          </View>
        ) : (
          <>
            {active.length ? (
              <Section title="Active">
                {active.map((o) => (
                  <OfferRow
                    key={o.id}
                    offer={o}
                    on
                    busy={pending === o.id}
                    onToggle={() => void toggle(o)}
                    onEdit={() => openEditor(o)}
                    onMore={() => more(o)}
                  />
                ))}
              </Section>
            ) : null}
            {inactive.length ? (
              <Section title="Inactive">
                {inactive.map((o) => (
                  <OfferRow
                    key={o.id}
                    offer={o}
                    on={false}
                    expired={o.validUntil <= now}
                    busy={pending === o.id}
                    onToggle={() => void toggle(o)}
                    onEdit={() => openEditor(o)}
                    onMore={() => more(o)}
                  />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>

      <OfferEditorSheet
        visible={editorOpen}
        merchantId={merchantId}
        offer={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          void load();
        }}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="eyebrow" color={colors.textMuted}>
          {title.toUpperCase()}
        </Text>
        <View style={styles.hairline} />
      </View>
      <View style={styles.cards}>{children}</View>
    </View>
  );
}

function OfferRow({
  offer,
  on,
  expired,
  busy,
  onToggle,
  onEdit,
  onMore,
}: {
  offer: Promotion;
  on: boolean;
  expired?: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onMore: () => void;
}) {
  return (
    <View style={[styles.card, !on && styles.cardOff]}>
      <View style={styles.preview}>
        <OfferCard size="compact" look={offer.look ?? DEFAULT_LOOK} headline={offerHeadline(offer, { withDate: false })} />
      </View>

      <View style={styles.discountRow}>
        <View style={styles.discountPill}>
          <Text style={styles.discountText}>{discountLabel(offer)}</Text>
        </View>
        <Text variant="microRegular" color={colors.textSecondary}>
          {scopeLabel(offer)}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.meta}>
          <View style={[styles.status, on ? styles.statusOn : styles.statusOff]}>
            <View style={[styles.statusDot, { backgroundColor: on ? colors.palette.green600 : colors.textMuted }]} />
            <Text variant="caption" color={on ? colors.palette.green600 : colors.textMuted}>
              {on ? 'Active' : expired ? 'Ended' : 'Inactive'}
            </Text>
          </View>
          <Text variant="micro" color={colors.textSecondary}>
            {offer.usageLimit
              ? `${offer.usedCount ?? 0}/${offer.usageLimit} used`
              : `${offer.usedCount ?? 0} used`}
          </Text>
          {offer.minOrder ? (
            <Text variant="captionRegular" color={colors.textMuted} numberOfLines={1} style={styles.shrink}>
              · Min {formatMoney(offer.minOrder)}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={on ? 'Switch offer off' : 'Switch offer on'}
            accessibilityState={{ checked: on, disabled: busy }}
            disabled={busy}
            onPress={onToggle}
            style={[styles.switch, on ? styles.switchOn : styles.switchOff, busy && styles.busy]}
          >
            <View style={[styles.knob, on && styles.knobOn]} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit offer" onPress={onEdit} style={styles.iconButton}>
            <Icon name="pencilSm" size={13} color={colors.palette.gray700} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={onMore} style={styles.iconButton}>
            <Icon name="more" size={14} color={colors.palette.gray700} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: spacing[12] },
  headerBleed: { marginHorizontal: -SCREEN_PADDING },
  create: {
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  section: { paddingTop: spacing[8] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[1.5] },
  hairline: { flex: 1, height: 0.5, backgroundColor: colors.border },
  cards: { gap: spacing[4], paddingTop: spacing[3.5] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.07)',
  },
  cardOff: { opacity: 0.7 },
  preview: { paddingTop: spacing[4], paddingHorizontal: spacing[4] },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
  },
  discountPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[0.5],
    borderRadius: radius.pill,
    backgroundColor: colors.palette.red25,
    borderWidth: 0.5,
    borderColor: 'rgba(212,43,43,0.15)',
  },
  discountText: { fontFamily: fontFamily[800], fontSize: 11, lineHeight: 16.5, color: colors.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  meta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  shrink: { flexShrink: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2.5],
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  statusOn: { backgroundColor: colors.palette.green25 },
  statusOff: { backgroundColor: colors.surfaceAlt },
  statusDot: { width: 4, height: 4, borderRadius: radius.pill },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], paddingLeft: spacing[3.5] },
  switch: { width: 40, height: 22, borderRadius: radius.pill, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.primary },
  switchOff: { backgroundColor: colors.borderStrong },
  busy: { opacity: 0.5 },
  knob: {
    width: 16,
    height: 16,
    marginLeft: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.10), 0px 1px 2px 0px rgba(0,0,0,0.10)',
  },
  knobOn: { marginLeft: 21 },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
