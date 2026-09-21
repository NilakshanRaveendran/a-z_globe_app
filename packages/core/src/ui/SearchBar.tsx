import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@core/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type SearchBarProps = {
  placeholder: string;
  value?: string;
  onChangeText?: (text: string) => void;
  /** When set the bar is a button rather than a field (the landing page). */
  onPress?: () => void;
  autoFocus?: boolean;
};

/**
 * Figma (31:11648, 26:10198): h45 · r:pill · #F3F4F6 · row gap 10 · pad 12/16 ·
 * icon 16 #9CA3AF · placeholder Urbanist 500 14/21 #9CA3AF.
 */
export function SearchBar({ placeholder, value, onChangeText, onPress, autoFocus }: SearchBarProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="search"
        onPress={onPress}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      >
        <Icon name="search" size={16} color={colors.textMuted} />
        <Text variant="bodyLg" color={colors.textMuted}>
          {placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.bar}>
      <Icon name="search" size={16} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3.5],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    minHeight: 45,
  },
  pressed: { opacity: 0.8 },
  input: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.text,
    // Android adds vertical padding to TextInput by default, which would make
    // the bar taller than the 45pt in the design.
    paddingVertical: 0,
  },
});
