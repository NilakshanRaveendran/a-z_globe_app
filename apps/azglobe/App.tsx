import { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppFonts } from '@core/theme';
import { ToastHost } from '@core/ui';
import { ErrorBoundary } from '@app/components/ErrorBoundary';
import { GestureRoot } from '@app/components/GestureRoot';
import { SessionProvider } from '@app/providers/SessionProvider';
import { RootNavigator } from '@app/navigation/RootNavigator';

// Keep the native splash up until Urbanist is ready, so no frame renders in the
// system font.
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Restaurant and menu data changes rarely; this keeps list screens from
      // refetching every time the user navigates back.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Browsers draw a rectangular focus ring inside the rounded field boxes; every
// field already shows its own border, so drop the ring on text inputs only.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus { outline: none; }';
  document.head.appendChild(style);
}

export default function App() {
  const [fontsLoaded, fontError] = useAppFonts();

  const onLayout = useCallback(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // A font failure must not leave a blank app — render with the fallback rather
  // than blocking forever.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureRoot style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <View style={{ flex: 1 }} onLayout={onLayout}>
              <ErrorBoundary>
                <RootNavigator />
              </ErrorBoundary>
              <ToastHost />
            </View>
            <StatusBar style="dark" />
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureRoot>
  );
}
