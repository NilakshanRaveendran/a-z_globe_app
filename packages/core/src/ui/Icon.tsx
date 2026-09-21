import { Icons, type IconName } from './icons';
import { colors } from '@core/theme';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/**
 * Renders a Figma-exported vector. Every glyph uses `currentColor`, so `color`
 * recolours it without needing a separate asset per state.
 */
export function Icon({ name, size = 16, color = colors.text }: IconProps) {
  const Glyph = Icons[name];
  return <Glyph width={size} height={size} color={color} />;
}
