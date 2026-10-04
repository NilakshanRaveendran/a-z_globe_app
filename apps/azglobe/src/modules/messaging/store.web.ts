import { useSyncExternalStore } from "react";
import { isFirebaseReady } from "@core/firebase";
import { seedState, type Member, type MessagingState, type Identity } from "./model";
import { diffState, normalisePhone } from "./sync";
import * as transport from "./transport.web";

/**
 * Messaging state, in one of two places.
 *
 * With Firebase configured, groups are shared: the state comes from Firestore
 * (through `transport.web.ts`) and every change is written back as the
 * documents it touches, so all members see it. Without Firebase the app is in
 * its design mode and the groups are the seeded examples, kept on this device.
 *
 * Either way the screens see the same thing — `state` and `update(fn)`.
 */
type Store = {
  get: () => MessagingState;
  ready: () => boolean;
  subscribe: (listener: () => void) => () => void;
  update: (fn: (previous: MessagingState) => MessagingState) => void;
};

/** True when groups are shared between people rather than kept on this device. */
export const sharedGroups = () => isFirebaseReady();

const EMPTY: MessagingState = {
  version: 1,
  groups: [],
  messages: [],
  saved: [],
  hidden: [],
  reports: [],
};

const syncErrors = new Set<(message: string) => void>();
/** Hear about a change the server refused or could not take. */
export function onSyncError(handler: (message: string) => void) {
  syncErrors.add(handler);
  return () => {
    syncErrors.delete(handler);
  };
}

function makeSharedStore(user: Identity): Store {
  let state = transport.peek(user) ?? EMPTY;
  let ready = !!transport.peek(user);
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());
  return {
    get: () => state,
    ready: () => ready,
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1)
        stop = transport.watch(user, (next) => {
          state = next;
          ready = true;
          changed();
        });
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stop?.();
          stop = undefined;
        }
      };
    },
    update: (fn) => {
      const next = fn(state);
      const ops = diffState(state, next, user);
      // Shown at once; the server's copy follows and replaces it.
      state = next;
      changed();
      if (ops.length)
        transport.apply(user, ops).catch(() => {
          syncErrors.forEach((handler) =>
            handler("That could not be saved. Check your connection and try again."),
          );
          transport.refresh(user);
        });
    },
  };
}

function makeStore(user: Identity): Store {
  const key = `azglobe:groups:v1:${user.id}`;
  let state = seedState(user);
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      saved?.version === 1 &&
      Array.isArray(saved.groups) &&
      Array.isArray(saved.messages)
    )
      state = saved;
  } catch {
    /* Private browsing may deny storage. */
  }
  const listeners = new Set<() => void>();
  window.addEventListener("storage", (event) => {
    if (event.key !== key || !event.newValue) return;
    try {
      const next = JSON.parse(event.newValue);
      if (
        next?.version !== 1 ||
        !Array.isArray(next.groups) ||
        !Array.isArray(next.messages)
      )
        return;
      state = next;
      listeners.forEach((listener) => listener());
    } catch {
      /* Ignore incomplete writes from another browser tab. */
    }
  });
  return {
    get: () => state,
    ready: () => true,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (fn: (previous: MessagingState) => MessagingState) => {
      const next = fn(state);
      // A rejected write must not be presented as a successfully saved message.
      localStorage.setItem(key, JSON.stringify(next));
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}

const stores = new Map<string, Store>();
let activeUser: Identity | undefined;
export function useMessagingStore(user: Identity) {
  activeUser = user;
  let store = stores.get(user.id);
  if (!store) {
    store = sharedGroups() ? makeSharedStore(user) : makeStore(user);
    stores.set(user.id, store);
  }
  const current = store;
  const state = useSyncExternalStore(current.subscribe, current.get, current.get);
  const loading = useSyncExternalStore(
    current.subscribe,
    () => !current.ready(),
    () => !current.ready(),
  );
  return { state, update: current.update, loading };
}

/**
 * The account signed in with this phone number, to add to a group. `null`
 * when nobody has signed in to A-Z Globe with it.
 */
export async function findPerson(input: string): Promise<Member | null> {
  const phone = normalisePhone(input);
  if (!phone) throw new Error("Enter a valid phone number.");
  if (!sharedGroups())
    return { id: `demo-${phone}`, name: `Contact ${phone.slice(-4)}`, role: "Member" };
  return transport.findPerson(phone);
}

// ── Attachments ────────────────────────────────────────────────────────────
// Every file is kept on this device (IndexedDB). In a shared group it is also
// sent to the server so the other members can open it; their copy is fetched
// the first time they look at it, then kept on their device too.

/** The largest attachment a shared group can carry — a Firestore document is 1 MB. */
const SHARED_FILE_LIMIT = 700 * 1024;

let fileGroup = "";
/** The chat being viewed: the group a file sent from here belongs to. */
export function setFileGroup(groupId: string) {
  fileGroup = groupId;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(blob);
  });
}
function fromBase64(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Photos straight from a camera are several MB; shrink them to fit. */
async function shrinkImage(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/") || blob.type === "image/gif" || blob.size <= 200 * 1024)
    return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    for (const [edge, quality] of [
      [1600, 0.75],
      [1280, 0.65],
      [960, 0.55],
    ] as const) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (out && out.size <= SHARED_FILE_LIMIT) return out;
    }
  } catch {
    /* Not a format this browser can draw — sent as it is, if it fits. */
  }
  return blob;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("azglobe-group-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Device storage is unavailable."));
  });
}
export async function saveFile(id: string, file: Blob) {
  let kept = file;
  if (sharedGroups()) {
    if (!activeUser || !fileGroup) throw new Error("Open a group to send files.");
    kept = await shrinkImage(file);
    if (kept.size > SHARED_FILE_LIMIT)
      throw new Error("This file is too large to send. Files are limited to 700 KB for now.");
    await transport.putFile(activeUser, id, {
      groupId: fileGroup,
      mime: kept.type || file.type || "application/octet-stream",
      data: await toBase64(kept),
    });
  }
  await saveLocal(id, kept);
}
async function saveLocal(id: string, file: Blob) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("Not enough device storage."));
      tx.onabort = () => reject(new Error("File could not be saved."));
    });
  } finally {
    db.close();
  }
}
export async function readFile(id: string): Promise<Blob | undefined> {
  const local = await readLocal(id).catch(() => undefined);
  if (local || !sharedGroups()) return local;
  const remote = await transport.getFile(id);
  if (!remote) return undefined;
  const blob = fromBase64(remote.data, remote.mime);
  void saveLocal(id, blob).catch(() => undefined);
  return blob;
}
async function readLocal(id: string): Promise<Blob | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Remove saved attachments — after "Delete for everyone", or an upload that failed part-way. */
export async function deleteFiles(ids: string[]) {
  if (!ids.length) return;
  if (sharedGroups()) void transport.removeFiles(ids).catch(() => undefined);
  const db = await database();
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction("files", "readwrite");
      const files = tx.objectStore("files");
      ids.forEach((id) => files.delete(id));
      tx.oncomplete = () => resolve();
      // Best effort: a file that cannot be removed only costs space.
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}
