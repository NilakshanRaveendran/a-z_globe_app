import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing, radius, shadows } from '@core/theme';
import { useLiveOrders } from '../hooks/useLiveOrders';
import { isTerminalStatus } from '../types';
import type { RootStackParamList } from '@app/navigation/types';

/** One entry point on Home, regardless of how many restaurants are preparing orders. */
export function ActiveOrderSection() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const orders = useLiveOrders();
  if (!orders.length) return null;
  const active = orders.filter(order => !isTerminalStatus(order.status));
  const names = [...new Set(orders.map(order => order.merchantName))].join(' · ');
  const ready = active.filter(order => order.status === 'ready_for_pickup').length;
  const onWay = active.filter(order => order.status === 'picked_up').length;
  const status = active.length === 0 ? 'Your orders are complete'
    : [ready ? `${ready} ready for pickup` : '', onWay ? `${onWay} on the way` : '',
      active.length - ready - onWay ? `${active.length - ready - onWay} with the restaurant` : ''].filter(Boolean).join(' · ');
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View live orders, ${orders.length} orders. ${names}. ${status}`}
      onPress={() => navigation.navigate('Food', { screen: 'LiveOrders' })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.row}>
        <View style={styles.icon}><Icon name="store" size={24} color={colors.primary} /></View>
        <View style={styles.flex}>
          <Text variant="h4">{orders.length === 1 ? 'Your order' : `${orders.length} restaurant orders`}</Text>
          <Text variant="bodySm" color={colors.textSecondary} numberOfLines={2}>{names}</Text>
        </View>
        <View style={styles.badge}><View style={styles.dot} /><Text variant="labelMd" color={colors.primary}>Live</Text></View>
      </View>
      <Text variant="bodyLg" color={colors.textStrong}>{status}</Text>
      <View style={styles.footer}><Text variant="labelLg" color={colors.primary}>View live {orders.length === 1 ? 'order' : 'orders'}</Text><Icon name="chevronRight" size={20} color={colors.primary} /></View>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[8] },
  card: { backgroundColor: colors.surface, borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.border, padding: 16, gap: 16, ...shadows.raised },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, gap: 4 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryTint, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
