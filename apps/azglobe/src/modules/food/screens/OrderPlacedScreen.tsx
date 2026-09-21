import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { Button, Screen, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';
import { getOrder } from '../services/orders';
import type { FoodStackParamList } from '../navigation/types';
import type { Order } from '../types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

/**
 * Order Placed — Figma 416:4243.
 *
 *   tick    150pt #FFF1F1 circle with a 2px #D42B2B check
 *   title   "Order Placed! 🎉" Urbanist 700 ~26
 *   body    "Your order is being prepared at <merchant>." #6B7280
 *   eta     "Estimated delivery: 25–40 min" in #D42B2B
 *   button  "Back to Menu"
 */
export function OrderPlacedScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'OrderPlaced'>>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    let active = true;
    getOrder(params.orderId).then((o) => {
      if (active) setOrder(o);
    });
    return () => {
      active = false;
    };
  }, [params.orderId]);

  // Measure the window from when the order was placed, falling back to now if
  // the timestamp is missing, and only render it when the result is sane.
  const etaMinutes = (() => {
    if (!order) return null;
    const from = order.createdAt || Date.now();
    const lo = Math.round((order.etaFrom - from) / 60_000);
    const hi = Math.round((order.etaTo - from) / 60_000);
    const plausible = Number.isFinite(lo) && Number.isFinite(hi) && lo >= 0 && hi <= 240;
    return plausible ? `${lo}–${hi} min` : null;
  })();

  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.tickWell}>
          <View style={styles.tickCircle}>
            <Text style={styles.tick}>✓</Text>
          </View>
        </View>

        <Text variant="h1" color={colors.textHeading} align="center" style={styles.title}>
          Order Placed! 🎉
        </Text>

        <Text variant="bodyLg" color={colors.textSecondary} align="center">
          Your order is being prepared at {order?.merchantName ?? 'the restaurant'}.
        </Text>

        {etaMinutes ? (
          <Text variant="bodyLg" color={colors.primary} align="center">
            Estimated delivery: {etaMinutes}
          </Text>
        ) : null}

        <Button
          label="Back to Menu"
          // Reset rather than navigate: the order is placed, so Checkout and the
          // now-empty Cart must not remain in the back stack behind this screen.
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'FoodLanding' }] })}
          fullWidth={false}
          style={styles.cta}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    gap: spacing[3],
  },
  tickWell: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    marginBottom: spacing[6],
  },
  tickCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  tick: { fontSize: 34, lineHeight: 40, color: colors.primary },
  title: { fontSize: 26, lineHeight: 34 },
  cta: { paddingHorizontal: spacing[12], marginTop: spacing[8] },
});
