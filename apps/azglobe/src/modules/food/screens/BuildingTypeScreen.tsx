import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BackButton, Icon, Screen, Text, type IconName } from '@core/ui';
import { colors, fontFamily, gradients, radius, SCREEN_PADDING, spacing } from '@core/theme';
import BuildingArt from '../../../../assets/icons/address/building-type-art.svg';
import type { BuildingType } from '../types';
import type { FoodStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<FoodStackParamList>;

const OPTIONS: Array<{ key: BuildingType; title: string; subtitle: string; icon: IconName }> = [
  { key: 'house', title: 'House', subtitle: 'Single or multi-family home', icon: 'house' },
  { key: 'apartment', title: 'Apartment', subtitle: 'Multi-unit residential building', icon: 'building' },
  { key: 'office', title: 'Office', subtitle: 'Workplace with entry restrictions', icon: 'briefcase' },
  { key: 'hotel', title: 'Hotel', subtitle: 'Lodging, motel or resort', icon: 'hotel' },
  { key: 'other', title: 'Other', subtitle: 'Hospital, park, outdoors, etc', icon: 'clock' },
];

/**
 * Choose building type — Figma 269:1625.
 *
 *   header  36pt circular #F3F4F6 back (chevron) · "Skip" 600 14/21 #6B7280
 *   art     370×200 r24 panel, #D42B2B → #B00000 → #000000, with the designer's
 *           skyline-and-pin illustration (180×160) centred
 *   title   "Choose building type" 800 22/33 #1F2937 · subtitle 500 13/18 #6B7280
 *   list    rows pad 16v, gap 16, 1px #F3F4F6 rule · 44pt r14 #F3F4F6 icon well
 *           with a 24pt #374151 glyph · title 700 15/22.5 · subtitle 500 12/18 ·
 *           18pt #9CA3AF chevron
 *
 * The type already on the address is marked — tinted well, red glyph and a
 * tick in place of the chevron — so the person can see what they are changing.
 */
export function BuildingTypeScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<FoodStackParamList, 'BuildingType'>>();
  const current = params?.current;

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton onPress={navigation.goBack} />
        <Pressable accessibilityRole="button" onPress={navigation.goBack} hitSlop={8}>
          <Text variant="labelLg" color={colors.textSecondary}>
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={gradients.buildingTypeArt}
          locations={gradients.buildingTypeArtStops}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.45, y: 1.55 }}
          style={styles.art}
        >
          {/* White at the designer's opacities via `color`; the pin keeps its red. */}
          <BuildingArt width={180} height={160} color={colors.onPrimary} />
        </LinearGradient>

        <View style={styles.titles}>
          <Text variant="h1" color={colors.text} style={styles.title}>
            Choose building type
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
            Let us know your building type for more accurate deliveries
          </Text>
        </View>

        <View style={styles.list}>
          {OPTIONS.map((option, i, arr) => {
            const selected = option.key === current;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
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
                <View style={[styles.iconWell, selected && styles.iconWellSelected]}>
                  <Icon
                    name={option.icon}
                    size={24}
                    color={selected ? colors.primary : colors.palette.gray700}
                  />
                </View>
                <View style={styles.flex}>
                  <Text variant="h4" color={selected ? colors.primary : colors.text}>
                    {option.title}
                  </Text>
                  <Text variant="bodySm" color={colors.textSecondary}>
                    {selected ? `${option.subtitle} · Current` : option.subtitle}
                  </Text>
                </View>
                {selected ? (
                  <View style={styles.tick}>
                    <Icon name="check" size={12} color={colors.onPrimary} />
                  </View>
                ) : (
                  <Icon name="chevronRight" size={18} color={colors.textMuted} />
                )}
              </Pressable>
            );
          })}
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
  pressed: { opacity: 0.7 },

  content: { paddingBottom: spacing[9] },
  art: {
    height: 200,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: radius['5xl'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titles: { paddingHorizontal: spacing[8], paddingTop: spacing[8], paddingBottom: spacing[3] },
  title: { fontFamily: fontFamily[800], fontSize: 22, lineHeight: 33 },
  subtitle: { lineHeight: 18, paddingTop: spacing[1.5] },

  list: { paddingHorizontal: SCREEN_PADDING },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingVertical: spacing[6],
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  iconWellSelected: { backgroundColor: colors.primaryTint },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  flex: { flex: 1 },
});
