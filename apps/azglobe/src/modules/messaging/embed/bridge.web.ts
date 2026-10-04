/**
 * What the native app hands the embedded messaging page — see
 * `../MessagingEmbed.tsx`, which writes it to `window.__AZ_EMBED__` before the
 * page's own script runs.
 */
export type EmbedConfig = {
  screen: "home" | "flow";
  params?: { groupId?: string; created?: boolean };
  user: { uid: string; fullName: string };
  accountKind: "customer" | "supplier" | null;
  firebaseReady: boolean;
};

export type EmbedMessage =
  | { type: "navigate"; name: "Messaging"; params?: EmbedConfig["params"] }
  | { type: "goBack" };

type Host = {
  __AZ_EMBED__?: EmbedConfig;
  ReactNativeWebView?: { postMessage: (data: string) => void };
};

export function embedConfig(): EmbedConfig {
  return (
    (window as unknown as Host).__AZ_EMBED__ ?? {
      screen: "home",
      user: { uid: "dev-vanan", fullName: "Vanan" },
      accountKind: "customer",
      firebaseReady: false,
    }
  );
}

export function postToApp(message: EmbedMessage) {
  (window as unknown as Host).ReactNativeWebView?.postMessage(
    JSON.stringify(message),
  );
}
