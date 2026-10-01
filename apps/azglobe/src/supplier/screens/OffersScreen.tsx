import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@core/ui/alert';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { colors, fontFamily, radius, SCREEN_PADDING, spacing } from '@core/theme';
import { EmptyState, Icon, Screen, Skeleton, Text, showToast } from '@core/ui';
import { formatMoney } from '@core/utils/currency';
import type { Promotion } from '@modules/food/types';
import { DEFAULT_LOOK, OfferCard } from '@modules/food/components/OfferCard';
import { discountLabel, isRunningOffer, offerHeadline, scopeLabel } from '@modules/food/services/promotions';
import type { RootStackParamList } from '@app/navigation/types';
import { deleteOffer, listOffers, setOfferActive } from '../services/offers';
import { SupplierHeader } from '../components/SupplierHeader';
import { ActionMenu, measureAnchor, type MenuAnchor } from '../components/ActionMenu';
import { OfferEditorSheet } from './OfferEditorSheet';

/**
 * Offers & Discounts — Figma 352:6743.
 *
 *   header   SupplierHeader — 36pt back, "Offers & Discounts" 700 22/33,
 *            restaurant name 400 13/19.5 #D42B2B
 *   create   56h r14 #D42B2B · 18pt plus-circle, gap 8 · "Create New Offer Card"
 *            700 15/22.5
 *   sections first label 44 under the button, then 32 between sections ·
 *            "ACTIVE" / "INACTIVE" 700 11/16.5 ls0.55 #9CA3AF, pad 0/4, gap 8 to
 *            a 0.5pt #E5E7EB rule · cards 10 below the label and 10 apart
 *   card     r16 · 0.51 #E5E7EB · shadow 0 1 3 7% · the compact OfferCard in
 *            pad 12 · discount row 8 below, gap 6: pill #FFF0F0, 0.51
 *            #D42B2B@15%, pad 2/8, 800 11/16.5 #D42B2B + "on All items" 400 11
 *            #6B7280 · footer pad 10/12: status pill pad 1/6 gap 3 (Active
 *            #F0FDF4/#16A34A, Inactive #F3F4F6/#9CA3AF, 4pt dot, 500 10/15),
 *            gap 6 · "34 used" 500 11/16.5 #6B7280 · "· Min Rs. 500" 400 10/15
 *            #9CA3AF · 40×22 toggle (on #D42B2B, off #D1D5DB, 16pt knob inset 3)
 *            · 30pt #F3F4F6 edit and ⋮ buttons, gap 6 · inactive cards at 70%
 *
 * A running offer is what customers see on this restaurant and get at checkout
 * automatically; an inactive or expired one does nothing.
 *
 * The ⋮ opens the shared provider popover (ActionMenu): Edit, Duplicate (a new
 * offer prefilled from this one), Switch on/off and Delete — one confirmation
 * for the delete, and a toast after every change. Each row's controls name the
 * offer they act on, so a screen reader doesn't hear three identical "More".
 */
export function OffersScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SupplierOffers'>>();
  const { merchantId, merchantName } = params;

  const [offers, setOffers] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [template, setTemplate] = useState<Promotion | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ offer: Promotion; anchor: MenuAnchor } | null>(null);

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
  // As the cart sees it: switched on, unexpired and not fully claimed.
  const running = (p: Promotion) => isRunningOffer(p, now);
  const active = (offers ?? []).filter(running);
  const inactive = (offers ?? []).filter((p) => !running(p));

  const toggle = async (offer: Promotion) => {
    if (offer.validUntil <= now) {
      Alert.alert('This offer has ended', 'Edit it and choose a new "Valid Until" date to run it again.');
      return;
    }
    if (offer.active === false && offer.usageLimit != null && (offer.usedCount ?? 0) >= offer.usageLimit) {
      Alert.alert('This offer is fully claimed', 'Edit it and raise the usage limit to run it again.');
      return;
    }
    const turningOn = offer.active === false;
    setPending(offer.id);
    try {
      await setOfferActive(offer, turningOn);
      await load();
      showToast(turningOn ? `${discountLabel(offer)} offer is on` : `${discountLabel(offer)} offer is off`);
    } catch {
      showToast('Could not update the offer. Try again.', { tone: 'error' });
    } finally {
      setPending(null);
    }
  };

  const confirmDelete = (offer: Promotion) =>
    Alert.alert(`Delete the ${discountLabel(offer)} offer?`, 'Customers will stop seeing it. This cannot be undone.', [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPending(offer.id);
          try {
            await deleteOffer(offer);
            await load();
            showToast('Offer deleted');
          } catch {
            showToast('Could not delete the offer. Try again.', { tone: 'error' });
          } finally {
            setPending(null);
          }
        },
      },
      { text: 'Keep', style: 'cancel' },
    ]);

  const openEditor = (offer: Promotion | null, from: Promotion | null = null) => {
    setEditing(offer);
    setTemplate(from);
    setEditorOpen(true);
  };

  const menuItems = (offer: Promotion) => {
    const isOn = running(offer);
    return [
      { label: 'Edit offer', icon: 'pencilSm' as const, onPress: () => openEditor(offer) },
      { label: 'Duplicate', icon: 'plusCircle' as const, onPress: () => openEditor(null, offer) },
      {
        label: isOn ? 'Switch off' : 'Switch on',
        icon: isOn ? ('xCircle' as const) : ('check' as const),
        hint: !isOn && offer.validUntil <= now ? 'Ended — edit the date to run it again' : undefined,
        disabled: !isOn && offer.validUntil <= now,
        onPress: () => void toggle(offer),
      },
      { label: 'Delete offer', icon: 'trash' as const, destructive: true, onPress: () => confirmDelete(offer) },
    ];
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

        <View style={styles.sections}>
          {offers === null ? (
            <View style={styles.section}>
              <Skeleton height={165} borderRadius={radius['3xl']} />
            </View>
          ) : offers.length === 0 ? (
            <View style={styles.section}>
              <EmptyState
                icon="offers"
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
                      onMore={(anchor) => setMenu({ offer: o, anchor })}
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
                      onMore={(anchor) => setMenu({ offer: o, anchor })}
                    />
                  ))}
                </Section>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <OfferEditorSheet
        visible={editorOpen}
        merchantId={merchantId}
        offer={editing}
        template={template}
        onClose={() => setEditorOpen(false)}
        onSaved={(kind) => {
          setEditorOpen(false);
          showToast(kind === 'created' ? 'Offer created' : 'Offer saved');
          void load();
        }}
      />

      <ActionMenu
        anchor={menu?.anchor ?? null}
        title={menu ? offerHeadline(menu.offer) : undefined}
        items={menu ? menuItems(menu.offer) : []}
        onClose={() => setMenu(null)}
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
  onMore: (anchor: MenuAnchor) => void;
}) {
  const more = useRef<View>(null);
  // Every control names its offer by its headline: "Edit 10% OFF on All items · Until 30 Sept".
  const name = offerHeadline(offer);
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
          <View style={[styles.status, styles.noShrink, on ? styles.statusOn : styles.statusOff]}>
            <View style={[styles.statusDot, { backgroundColor: on ? colors.palette.green600 : colors.textMuted }]} />
            <Text variant="caption" color={on ? colors.palette.green600 : colors.textMuted}>
              {on ? 'Active' : expired ? 'Ended' : 'Inactive'}
            </Text>
          </View>
          <Text variant="micro" color={colors.textSecondary} numberOfLines={1} style={styles.noShrink}>
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
            accessibilityLabel={`${name} — ${on ? 'switch off' : 'switch on'}`}
            accessibilityState={{ checked: on, disabled: busy }}
            disabled={busy}
            onPress={onToggle}
            style={[styles.switch, on ? styles.switchOn : styles.switchOff, busy && styles.busy]}
          >
            <View style={[styles.knob, on && styles.knobOn]} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${name}`} onPress={onEdit} style={styles.iconButton}>
            <Icon name="pencilSm" size={13} color={colors.palette.gray700} />
          </Pressable>
          <Pressable
            ref={more}
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${name}`}
            onPress={() => measureAnchor(more, onMore)}
            style={styles.iconButton}
          >
            <Icon name="moreVertical" size={14} color={colors.palette.gray700} />
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
  sections: { paddingTop: spacing[9], gap: spacing[4] },
  section: { paddingTop: spacing[8] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[1.5] },
  hairline: { flex: 1, height: 0.5, backgroundColor: colors.border },
  cards: { gap: spacing[3.5], paddingTop: spacing[3.5] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['3xl'],
    borderWidth: 0.51,
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
    borderWidth: 0.51,
    borderColor: 'rgba(212,43,43,0.15)',
  },
  discountText: { fontFamily: fontFamily[800], fontSize: 11, lineHeight: 16.5, color: colors.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  // On a narrow phone "· Min Rs. 500" drops to a second line rather than squeezing "12 used".
  meta: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing[2.5],
    rowGap: spacing[0.5],
  },
  noShrink: { flexShrink: 0 },
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
