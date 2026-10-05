import { notificationPrefs, saveInbox } from "@app/notifications/inbox";
import { useSyncExternalStore } from "react";
import { seedState, type MessagingState, type Identity } from "./model";

const stores = new Map<string, ReturnType<typeof makeStore>>();
function makeStore(user: Identity) {
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
      if (notificationPrefs(user.id).groups) {
        const added = next.groups.filter(group => group.members.some(member => member.id === user.id)
          && !state.groups.find(previous => previous.id === group.id)?.members.some(member => member.id === user.id)
          && group.creator !== user.id);
        saveInbox(`${user.provider ? 'supplier' : 'customer'}:${user.id}`, added.map(group => ({
          id: `group:${group.id}:membership:${Date.now()}`, kind: 'groups', at: Date.now(),
          title: 'Group membership confirmed', body: `You are now a member of ${group.name}.`,
          target: { type: 'group', groupId: group.id },
        })));
      }
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}
export function useMessagingStore(user: Identity) {
  let store = stores.get(user.id);
  if (!store) {
    store = makeStore(user);
    stores.set(user.id, store);
  }
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  return { state, update: store.update };
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
