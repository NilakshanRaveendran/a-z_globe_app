import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@core/theme';
import { Text } from './Text';

export type SegmentedTabsProps<T extends string> = {
  tabs: ReadonlyArray<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
};

/**
 * The Menu / Reviews / Info switcher on the restaurant page.
 *
 * Figma (17:4787): row with a 1px #F3F4F6 bottom rule; each tab is an equal
 * third, pad 12 vertical, label Urbanist 600 14/21. The active tab is #D42B2B
 * with a 1px #D42B2B underline; inactive labels are #9CA3AF.
 */
export function SegmentedTabs<T extends string>({ tabs, active, onChange }: SegmentedTabsProps<T>) {
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Text
              variant="labelLg"
              color={isActive ? colors.primary : colors.textMuted}
              align="center"
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
});
