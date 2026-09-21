import { StyleSheet, View } from 'react-native';
import { Icon, Screen, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';

/**
 * Messages tab.
 *
 * The Figma BottomNav (31:12072) includes this tab, but the file contains no
 * Messages screen — so rather than invent one, it renders an empty state in the
 * design's own language. Replace this when the screen is designed.
 */
export function MessagesScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h1" color={colors.textHeading} style={styles.title}>
          Messages
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWell}>
          <Icon name="bell" size={28} color={colors.textMuted} />
        </View>
        <Text variant="h3" color={colors.textStrong} align="center">
          No messages yet
        </Text>
        <Text variant="bodyLg" color={colors.textSecondary} align="center">
          Updates about your orders and chats with restaurants will appear here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing[5] },
  title: { fontSize: 26, lineHeight: 34 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[12],
  },
  iconWell: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing[4],
  },
});
