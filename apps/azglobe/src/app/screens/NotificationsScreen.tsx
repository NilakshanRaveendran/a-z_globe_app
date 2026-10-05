import { useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Icon, Button } from '@core/ui';
import { colors, spacing } from '@core/theme';
import { createStorage } from '@core/storage';
import { useSession } from '@app/providers/SessionProvider';
import type { RootStackParamList } from '@app/navigation/types';
import { loadInbox, readInbox, type InboxItem } from '@app/notifications/inbox';

const storage = createStorage({ id: 'notification-read-state' });
export function NotificationsScreen() {
  const { user, accountKind } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const focused = useIsFocused();
  const business = accountKind === 'supplier';
  const readKey = `${accountKind}:${user.uid}`;
  const [read, setRead] = useState<string[]>(() => {
    try { return JSON.parse(storage.getString(readKey) ?? '[]'); } catch { return []; }
  });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useQuery({
    queryKey: ['notifications', accountKind, user.uid],
    enabled: focused,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: focused ? 30000 : false,
    queryFn: () => loadInbox(user.uid, business),
  });
  const items = query.data?.items ?? readInbox(readKey);
  const unread = items.filter(item => !read.includes(item.id));
  const markRead = (ids: string[]) => {
    const next = [...new Set([...read, ...ids])];
    setRead(next);
    storage.set(readKey, JSON.stringify(next));
  };
  const open = (item: InboxItem) => {
    markRead([item.id]);
    const target = item.target;
    if (target.type === 'group') navigation.navigate('Messaging', { groupId: target.groupId });
    else if (target.type === 'offer') navigation.navigate('Food', { screen: 'Restaurant', params: { merchantId: target.merchantId } });
    else if (business) navigation.navigate(target.closed ? 'SupplierOrderHistory' : 'SupplierOrders', {
      merchantId: target.merchantId, merchantName: target.merchantName,
    });
    else navigation.navigate('Food', { screen: 'OrderTracking', params: { orderId: target.orderId } });
  };
  return <Screen>
    <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
    <View style={styles.filters}>
      {[false, true].map(value => <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: unreadOnly === value }} onPress={() => setUnreadOnly(value)} style={[styles.chip, unreadOnly === value && styles.chipOn]}>
        <Text variant="labelMd" color={unreadOnly === value ? colors.primary : colors.textSecondary}>{value ? `Unread${unread.length ? ` (${unread.length})` : ''}` : 'All'}</Text>
      </Pressable>)}
    </View>
    {unread.length > 0 && <Pressable accessibilityRole="button" onPress={() => { markRead(items.map(item => item.id)); setUnreadOnly(false); }} style={styles.mark}><Text variant="labelMd" color={colors.primary}>Mark all read</Text></Pressable>}
    <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}>
      {(query.data?.failed || query.isError) && <View style={styles.warning}><Text variant="bodySm" color={colors.textSecondary}>Some updates couldn't be loaded. Your saved notifications are still here.</Text><Button label="Retry" onPress={() => void query.refetch()} /></View>}
      {query.isPending && !items.length ? <ActivityIndicator color={colors.primary} /> : (unreadOnly ? unread : items).length === 0 ? <View style={styles.empty}><Icon name="bell" size={36} color={colors.primary} /><Text variant="h3">{unreadOnly ? "You're all caught up" : 'No notifications yet'}</Text><Text variant="body" color={colors.textSecondary} align="center">Order updates, offers, and group notifications will appear here.</Text></View> : (unreadOnly ? unread : items).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${!read.includes(item.id) ? 'Unread. ' : ''}${item.title}. ${item.body}`} onPress={() => open(item)} style={[styles.card, !read.includes(item.id) && styles.unread]}>
        <View style={styles.icon}><Icon name={item.kind === 'orders' ? 'utensils' : item.kind === 'offers' ? 'offers' : 'person'} size={22} color={colors.primary} /></View>
        <View style={styles.copy}><Text variant="labelLg" color={colors.textHeading}>{item.title}</Text><Text variant="bodySm" color={colors.textSecondary}>{item.body}</Text>{item.target.type === 'offer' && item.target.expires <= Date.now() && <Text variant="caption" color={colors.textMuted}>Offer expired</Text>}<Text variant="caption" color={colors.textMuted}>{new Date(item.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text></View>
        {!read.includes(item.id) && <View style={styles.dot} />}
        <Icon name="chevronRight" size={16} color={colors.textMuted} />
      </Pressable>)}
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primaryTint },
  warning: { padding: 12, gap: 12, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  mark: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 12 },
  list: { padding: 16, gap: 10, paddingBottom: spacing[10] },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unread: { backgroundColor: colors.primaryTint, borderColor: colors.primaryOutline },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  copy: { flex: 1, gap: 4 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primaryAccent },
  empty: { alignItems: 'center', gap: 16, paddingVertical: 60 },
});
