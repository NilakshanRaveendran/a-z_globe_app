import type { Identity, Member, MessagingState } from "../model";
import type { Op } from "../sync";

/**
 * The embedded page's side of the bridge. Firestore lives in the native app
 * (the page has no Firebase sign-in of its own), so the page asks for what it
 * needs and the native side — `MessagingEmbed.tsx` — answers.
 */
type Host = {
  __AZ_STATE__?: MessagingState | null;
  __azMessaging?: {
    state: (state: MessagingState) => void;
    reply: (id: number, error: string | null, result: unknown) => void;
  };
  ReactNativeWebView?: { postMessage: (data: string) => void };
};
const host = window as unknown as Host;

const listeners = new Set<(state: MessagingState) => void>();
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let latest: MessagingState | null = host.__AZ_STATE__ ?? null;
let calls = 0;

host.__azMessaging = {
  state: (state) => {
    latest = state;
    listeners.forEach((listener) => listener(state));
  },
  reply: (id, error, result) => {
    const call = pending.get(id);
    pending.delete(id);
    if (error) call?.reject(new Error(error));
    else call?.resolve(result);
  },
};

function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const id = ++calls;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    host.ReactNativeWebView?.postMessage(JSON.stringify({ type: "rpc", id, method, args }));
  });
}

export function watch(_user: Identity, onState: (state: MessagingState) => void) {
  listeners.add(onState);
  if (latest) onState(latest);
  // Ask for the current state: the first push can arrive before the page does.
  host.ReactNativeWebView?.postMessage(JSON.stringify({ type: "watch" }));
  return () => {
    listeners.delete(onState);
  };
}
export const peek = (_user: Identity) => latest;
export const refresh = (_user: Identity) => {
  host.ReactNativeWebView?.postMessage(JSON.stringify({ type: "watch" }));
};
export const apply = (_user: Identity, ops: Op[]) => call<void>("apply", ops);
export const findPerson = (phone: string) => call<Member | null>("findPerson", phone);
export const putFile = (
  _user: Identity,
  id: string,
  file: { groupId: string; mime: string; data: string },
) => call<void>("putFile", id, file);
export const getFile = (id: string) =>
  call<{ mime: string; data: string } | null>("getFile", id);
export const removeFiles = (ids: string[]) => call<void>("removeFiles", ids);
