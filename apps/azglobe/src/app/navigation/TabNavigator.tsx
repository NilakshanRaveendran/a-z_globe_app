import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavIcons, Text } from '@core/ui';
import { colors, spacing } from '@core/theme';
import { HomeScreen } from '@app/screens/HomeScreen';
import { MessagesScreen } from '@app/screens/MessagesScreen';
import { ProfileScreen } from '@app/screens/ProfileScreen';
import { CartTabScreen } from '@app/screens/CartTabScreen';
import { useCart } from '@modules/food/store/cart';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type TabKey = keyof typeof NavIcons;

/**
 * Figma BottomNav (31:12072):
 *   bar   h66 · #FFFFFF · 1px top border #F3F4F6 · pad 5v / 8h
 *   item  col gap 3 · pad 8v · icon 22 · label Urbanist 500 10/15
 *   active #D42B2B, inactive #9CA3AF
 *
 * Order is Messages · Cart · Home · Profile, with Home the default tab.
 */
export function TabNavigator() {
  const insets = useSafeAreaInsets();
  const itemCount = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.bar, { height: 66 + insets.bottom, paddingBottom: insets.bottom }],
        tabBarItemStyle: styles.item,
        // The label is rendered inside tabBarIcon so icon and text share one
        // 3pt gap exactly as the design specifies.
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabItem tab="Messages" label="Messages" focused={focused} /> }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartTabScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem tab="Cart" label="Cart" focused={focused} badge={itemCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabItem tab="Home" label="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabItem tab="Profile" label="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function TabItem({
  tab,
  label,
  focused,
  badge,
}: {
  tab: TabKey;
  label: string;
  focused: boolean;
  badge?: number;
}) {
  const Glyph = NavIcons[tab];
  const tint = focused ? colors.primary : colors.textMuted;

  return (
    <View style={styles.tabItem}>
      <View>
        <Glyph width={22} height={22} color={tint} />
        {badge ? (
          <View style={styles.badge}>
            <Text variant="badge" color={colors.onPrimary}>
              {badge > 9 ? '9+' : String(badge)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="tabLabel" color={tint} align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    // The shorthand, not borderTopColor: React Navigation sets `borderColor`
    // itself, and on web the shorthand it passes wins over a longhand.
    borderColor: colors.surfaceAlt,
    paddingTop: spacing[2],
    // React Navigation applies its own elevation; the design has none.
    elevation: 0,
    boxShadow: 'none',
  },
  item: { paddingVertical: spacing[3] },
  tabItem: { alignItems: 'center', gap: spacing[1], width: 74 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
