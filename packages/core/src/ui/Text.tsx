import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, typography } from '@core/theme';

type Variant = keyof typeof typography;

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
};

/**
 * Every piece of text in the app goes through here. Using the raw RN <Text/>
 * risks falling back to the system font, which silently breaks Figma parity —
 * so `variant` (a measured Urbanist preset) is the only way to style type.
 */
export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: TextProps) {
  return <RNText style={[typography[variant], { color }, align ? { textAlign: align } : null, style]} {...rest} />;
}
