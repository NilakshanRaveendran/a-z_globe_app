import { StyleSheet, View } from 'react-native';
import { BackButton, EmptyState, Screen } from '@core/ui';
import { SCREEN_PADDING, spacing } from '@core/theme';

/**
 * Full-screen "couldn't load" / "not found" state for a detail page
 * (Restaurant, Item detail).
 *
 * A detail page used to show its skeleton until the data arrived — so a bad id
 * or a failed read left the customer on a grey placeholder with no way back.
 * This keeps the page's back affordance (the 40pt white circle the hero uses)
 * and offers Retry when the failure might be temporary.
 */
export function LoadErrorState({
  title,
  message,
  onBack,
  onRetry,
}: {
  title: string;
  message: string;
  onBack: () => void;
  /** Omitted for "not found": retrying a missing document changes nothing. */
  onRetry?: () => void;
}) {
  return (
    <Screen>
      <View style={styles.bar}>
        <BackButton onPress={onBack} />
      </View>
      <EmptyState
        variant="page"
        icon={onRetry ? 'warning' : 'search'}
        title={title}
        message={message}
        actionLabel={onRetry ? 'Retry' : 'Go back'}
        onAction={onRetry ?? onBack}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing[4] },
});
