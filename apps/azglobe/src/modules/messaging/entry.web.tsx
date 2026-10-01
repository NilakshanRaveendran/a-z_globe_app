import { lazy, Suspense, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@core/theme';

/**
 * Messages loads on first use. The group screens, their stylesheet, the emoji
 * picker and its emoji data are a large part of the web bundle and none of it
 * is needed until Messages is opened, so it is fetched then rather than at
 * startup.
 */
const LazyFlow = lazy(() => import('./MessagingFlow.web').then((m) => ({ default: m.MessagingFlow })));
const LazyHome = lazy(() => import('./MessagingHome.web').then((m) => ({ default: m.MessagingHome })));

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function MessagingFlow() {
  return (
    <Suspense fallback={<Loading />}>
      <LazyFlow />
    </Suspense>
  );
}

export function MessagesScreen(props: ComponentProps<typeof LazyHome>) {
  return (
    <Suspense fallback={<Loading />}>
      <LazyHome {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
