import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@core/ui';
import { colors, SCREEN_PADDING, spacing } from '@core/theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Last line of defence for a render error — one malformed document must not
 * white-screen the web app or crash the native one to the home screen.
 * "Try again" remounts the tree, which re-runs every screen's loaders.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text variant="h2" align="center">
          Something went wrong
        </Text>
        <Text variant="bodyLg" color={colors.textSecondary} align="center">
          This screen couldn't be shown. Try again, and if it keeps happening, restart the app.
        </Text>
        <Button label="Try again" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing[6],
    paddingHorizontal: SCREEN_PADDING * 2,
    backgroundColor: colors.background,
  },
});
