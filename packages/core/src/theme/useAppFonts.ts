import { useFonts } from 'expo-font';

// Import each weight by subpath. Importing from the package root pulls in all 18
// faces (including italics we never use) and adds ~500KB to the bundle.
import { Urbanist_400Regular } from '@expo-google-fonts/urbanist/400Regular';
import { Urbanist_500Medium } from '@expo-google-fonts/urbanist/500Medium';
import { Urbanist_600SemiBold } from '@expo-google-fonts/urbanist/600SemiBold';
import { Urbanist_700Bold } from '@expo-google-fonts/urbanist/700Bold';
import { Urbanist_800ExtraBold } from '@expo-google-fonts/urbanist/800ExtraBold';
import { Urbanist_900Black } from '@expo-google-fonts/urbanist/900Black';

/**
 * Urbanist is the only typeface in the Figma design. Every weight referenced by
 * `fontFamily` in tokens.ts must be loaded here, or React Native silently falls
 * back to the system font and the whole app drifts off-design.
 */
export function useAppFonts(): [boolean, Error | null] {
  const [loaded, error] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
    Urbanist_800ExtraBold,
    Urbanist_900Black,
  });
  return [loaded, error ?? null];
}
