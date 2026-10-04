import { embedConfig } from "./bridge.web";

/** Stands in for the app's SessionProvider: the native session, passed in. */
export function useSession() {
  const { user, accountKind } = embedConfig();
  return { user, accountKind };
}
