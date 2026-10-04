/**
 * How the screens reach the shared groups. In the web app that is Firestore
 * directly; inside the native app's WebView this module is swapped for
 * `embed/transport.web.ts`, which asks the native side to do the same things.
 */
import type { Identity } from "./model";
import * as remote from "./remote";

export const { watch, apply, findPerson, getFile, removeFiles } = remote;
export const peek = (user: Identity) => remote.peek(user.id);
export const refresh = (user: Identity) => remote.refresh(user.id);
export const putFile = remote.putFile;
