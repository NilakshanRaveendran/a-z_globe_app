import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Screen, Text } from '@core/ui';
import { colors, radius, SCREEN_PADDING, spacing } from '@core/theme';
import type { BuildingType } from '../types';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

const OPTIONS: Array<{ key: BuildingType; title: string; subtitle: string; icon: 'mapPin' | 'store' | 'clock' }> = [
  { key: 'house', title: 'House', subtitle: 'Single or multi-family home', icon: 'mapPin' },
  { key: 'apartment', title: 'Apartment', subtitle: 'Multi-unit residential building', icon: 'store' },
  { key: 'office', title: 'Office', subtitle: 'Workplace with entry restrictions', icon: 'store' },
  { key: 'hotel', title: 'Hotel', subtitle: 'Lodging, motel or resort', icon: 'store' },
  { key: 'other', title: 'Other', subtitle: 'Hospital, park, outdoors, etc', icon: 'clock' },
];

/**
 * Choose building type — Figma 269:1625.
 *
 *   header  36pt circular back on the left, "Skip" on the right
 *   art     red gradient panel with a stylised skyline
 *   title   "Choose building type" Urbanist 700 ~22 + subtitle #6B7280
 *   list    icon well 40 · title 15/22.5 · subtitle 12/18 · chevron, 1px rules
 */
export function BuildingTypeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name="arrowLeft" size={18} color={colors.text} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={navigation.goBack} hitSlop={8}>
          <Text variant="bodyLg" color={colors.textSecondary}>
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[colors.palette.red600, '#7A0000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.art}
        >
          {/* A simple skyline, matching the illustration in the design. */}
          <View style={styles.skyline}>
            <View style={[styles.tower, { height: 70 }]} />
            <View style={[styles.tower, { height: 110 }]} />
            <View style={[styles.tower, { height: 58 }]} />
          </View>
          <View style={styles.ground} />
        </LinearGradient>

        <View style={styles.titles}>
          <Text variant="h1" color={colors.textHeading} style={styles.title}>
            Choose building type
          </Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            Let us know your building type for more accurate deliveries
          </Text>
        </View>

        <View>
          {OPTIONS.map((option, i, arr) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              // Hand the choice back to Address info — merge keeps everything
              // else the person had typed there.
              onPress={() =>
                navigation.popTo('AddressInfo', { buildingType: option.key }, { merge: true })
              }
              style={({ pressed }) => [
                styles.row,
                i < arr.length - 1 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconWell}>
                <Icon name={option.icon} size={18} color={colors.text} />
              </View>
              <View style={styles.flex}>
                <Text variant="h4" color={colors.textStrong}>
                  {option.title}
                </Text>
                <Text variant="bodySm" color={colors.textSecondary}>
                  {option.subtitle}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[4],
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.7 },

  content: { paddingBottom: spacing[8] },
  art: {
    height: 200,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: radius['4xl'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  skyline: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3], marginBottom: 34 },
  tower: { width: 42, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.22)' },
  ground: {
    position: 'absolute',
    bottom: 22,
    width: 240,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  titles: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[8], gap: spacing[1.5] },
  title: { fontSize: 22, lineHeight: 30 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing[6],
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  flex: { flex: 1 },
});
