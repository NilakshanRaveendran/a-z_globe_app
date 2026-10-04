import { embedConfig, postToApp, type EmbedConfig } from "./bridge.web";

/**
 * Stands in for `@react-navigation/native` inside the embedded page. The
 * messaging screens only navigate to a chat and go back; both are handed to
 * the native navigator, which owns the stack.
 */
export function useNavigation<T = unknown>() {
  return {
    navigate: (name: "Messaging", params?: EmbedConfig["params"]) =>
      postToApp({ type: "navigate", name, params }),
    goBack: () => postToApp({ type: "goBack" }),
  } as unknown as T;
}

export function useRoute<T = unknown>() {
  return { params: embedConfig().params } as unknown as T;
}
