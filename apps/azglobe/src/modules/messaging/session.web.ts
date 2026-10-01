import { useSession } from "@app/providers/SessionProvider";
import { isFirebaseReady } from "@core/firebase";
import type { Identity } from "./model";
import { useMessagingStore } from "./store.web";

export function useGroupSession() {
  const session = useSession();
  // Isolated design-mode persona, never a way to override a Firebase account.
  const previewProvider =
    !isFirebaseReady() &&
    new URLSearchParams(window.location.search).get("messagingRole") ===
      "provider";
  const user: Identity = previewProvider
    ? { id: "demo-provider", name: "Yaal Angaadi", provider: true }
    : {
        id: session.user.uid,
        name: session.user.fullName,
        provider: session.accountKind === "supplier",
      };
  return { user, ...useMessagingStore(user) };
}
