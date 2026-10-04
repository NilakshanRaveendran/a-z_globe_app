import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Screen } from '@core/ui';
import { colors } from '@core/theme';
import { isFirebaseReady } from '@core/firebase';
import { useSession } from '@app/providers/SessionProvider';
import type { RootStackParamList } from '@app/navigation/types';
import html from './embed/generated/html';
import type { Identity, MessagingState } from './model';
import * as remote from './remote';
import type { Op } from './sync';

type Params = { groupId?: string; created?: boolean };

type FromPage =
  | { type: 'navigate'; params?: Params }
  | { type: 'goBack' }
  | { type: 'watch' }
  | { type: 'rpc'; id: number; method: string; args: unknown[] };

/**
 * The page's origin. Nothing is served from it — the document is handed over
 * whole — but an https origin makes the page a secure context (camera,
 * microphone and location need one) and gives its localStorage and IndexedDB
 * a stable home, shared by the Messages tab and an open chat.
 */
const ORIGIN = 'https://messaging.azglobe.app';

/**
 * A-Z Groups on Android and iOS.
 *
 * The messaging module is browser code, so native shows the same screens in a
 * WebView rather than a second implementation of them. The page is bundled
 * into the app (`tools/build-messaging-embed.mjs`); the signed-in account is
 * passed in, and the page asks this component to navigate, because the native
 * stack owns the screens.
 *
 * It also asks this component for its data. The page cannot sign in to
 * Firebase itself, so the shared groups (`remote.ts`) run here: their state is
 * pushed into the page whenever it changes, and the page's changes come back
 * as calls (`embed/transport.web.ts` is the other end).
 */
function MessagingEmbed({ screen, params }: { screen: 'home' | 'flow'; params?: Params }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, accountKind } = useSession();
  const web = useRef<WebView>(null);
  const shared = isFirebaseReady();

  const identity = useMemo<Identity>(
    () => ({ id: user.uid, name: user.fullName, provider: accountKind === 'supplier' }),
    [user.uid, user.fullName, accountKind]
  );

  const config = useMemo(
    () =>
      JSON.stringify({
        screen,
        params,
        user: { uid: user.uid, fullName: user.fullName },
        accountKind,
        firebaseReady: shared,
      }),
    [screen, params, user.uid, user.fullName, accountKind, shared]
  );

  const run = useCallback((script: string) => web.current?.injectJavaScript(`${script};true;`), []);
  const pushState = useCallback(
    (state: MessagingState) =>
      run(`window.__azMessaging&&window.__azMessaging.state(${JSON.stringify(state)})`),
    [run]
  );

  // Shared groups: keep the page in step with Firestore.
  useEffect(() => {
    if (!shared) return;
    return remote.watch(identity, pushState);
  }, [shared, identity, pushState]);

  // Design mode keeps everything in the page's own storage. A chat opened
  // from the list is a second WebView, and storage events between the two are
  // not guaranteed, so on returning, replay the saved state into this page.
  useEffect(() => {
    if (shared) return;
    return navigation.addListener('focus', () => {
      run(
        `(function(){try{var k='azglobe:groups:v1:'+${JSON.stringify(user.uid)};var v=localStorage.getItem(k);if(v)window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:v}));}catch(e){}})()`
      );
    });
  }, [shared, navigation, run, user.uid]);

  const call = async (method: string, args: unknown[]): Promise<unknown> => {
    switch (method) {
      case 'apply':
        return remote.apply(identity, args[0] as Op[]);
      case 'findPerson':
        return remote.findPerson(args[0] as string);
      case 'putFile':
        return remote.putFile(identity, args[0] as string, args[1] as remote.StoredFile);
      case 'getFile':
        return remote.getFile(args[0] as string);
      case 'removeFiles':
        return remote.removeFiles(args[0] as string[]);
      default:
        throw new Error(`Unknown call: ${method}`);
    }
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let message: FromPage;
    try {
      message = JSON.parse(event.nativeEvent.data) as FromPage;
    } catch {
      return; // Not one of ours.
    }
    if (message.type === 'navigate') navigation.navigate('Messaging', message.params);
    else if (message.type === 'goBack') {
      if (navigation.canGoBack()) navigation.goBack();
    } else if (message.type === 'watch') {
      const state = remote.peek(identity.id);
      if (state) pushState(state);
    } else if (message.type === 'rpc') {
      const { id } = message;
      call(message.method, message.args).then(
        (result) =>
          run(`window.__azMessaging.reply(${id},null,${JSON.stringify(result ?? null)})`),
        (error: unknown) =>
          run(
            `window.__azMessaging.reply(${id},${JSON.stringify(
              error instanceof Error ? error.message : 'Failed'
            )},null)`
          )
      );
    }
  };

  // The account, and what is already known of its groups, are written into the
  // page itself — ahead of its own script — so a chat opens filled in. They
  // are not injected: on Android an injected script races the page's start-up,
  // and a page that starts first comes up in design mode as the demo user.
  const initial = useRef(shared ? remote.peek(user.uid) : null).current;
  const page = useMemo(() => {
    // Written as an escape, so no text in the data can close the script element.
    const safe = (json: string) => json.replace(/</g, '\\u003c');
    const boot = `<script>window.__AZ_EMBED__=${safe(config)};window.__AZ_STATE__=${safe(
      JSON.stringify(initial)
    )};</script>`;
    return html.replace('<!--az-config-->', () => boot);
  }, [config, initial]);

  return (
    <Screen edges={screen === 'flow' ? ['top', 'bottom'] : ['top']} backgroundColor={colors.surface}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <WebView
          ref={web}
          // The account is part of the page's start-up state.
          key={config}
          style={styles.fill}
          source={{ html: page, baseUrl: ORIGIN }}
          originWhitelist={['*']}
          onMessage={onMessage}
          // The first WebView of a session takes a moment to start; show the
          // app's own spinner rather than a blank page.
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          // Map links and shared web links open in the browser, not in the chat.
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith(ORIGIN) || request.url.startsWith('about:')) return true;
            if (/^(https?|geo|tel|mailto):/.test(request.url)) void Linking.openURL(request.url);
            return false;
          }}
          setSupportMultipleWindows={false}
          domStorageEnabled
          geolocationEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          textZoom={100}
          overScrollMode="never"
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** A group chat, or the groups list when opened without one. */
export function MessagingFlow() {
  const route = useRoute<RouteProp<RootStackParamList, 'Messaging'>>();
  return <MessagingEmbed screen="flow" params={route.params} />;
}

/** The Messages tab: the groups list. */
export function MessagesScreen() {
  return <MessagingEmbed screen="home" />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
