import { createRoot } from "react-dom/client";
import { MessagingFlow } from "../MessagingFlow.web";
import { MessagingHome } from "../MessagingHome.web";
import { embedConfig } from "./bridge.web";

/**
 * Entry point of the messaging page the native app shows in a WebView.
 *
 * The messaging module is browser code (DOM, CSS, IndexedDB, MediaRecorder),
 * so on Android and iOS it runs as a page rather than as native views.
 * `tools/build-messaging-embed.mjs` bundles this file into one HTML document,
 * swapping the app's navigation, session and asset modules for the stand-ins
 * in this folder.
 */
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    embedConfig().screen === "flow" ? <MessagingFlow /> : <MessagingHome />,
  );
}
