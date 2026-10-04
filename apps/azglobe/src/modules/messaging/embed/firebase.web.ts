import { embedConfig } from "./bridge.web";

export function isFirebaseReady(): boolean {
  return embedConfig().firebaseReady;
}
