import { getApp } from "@core/firebase";
import { getAuth } from "@core/firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "@core/firebase/firestore";
import type { Group, Identity, Member, Message, MessagingState } from "./model";
import type { Op } from "./sync";

/**
 * A-Z Groups in Firestore — what makes a group the same group on every
 * member's phone.
 *
 *   chatGroups/{id}              name, rules, permissions, owner,
 *                                members { uid: { name, role } }, memberIds[]
 *   chatGroups/{id}/messages/    one document per message
 *   chatFiles/{id}               an attachment's bytes (base64) — Cloud Storage
 *                                needs the Blaze plan, so files live in
 *                                Firestore and are limited by its 1 MB document
 *   chatDirectory/{phone}        phone number → account, so an admin can add
 *                                someone by their number (get only, no listing)
 *   chatUsers/{uid}              what is private to one member: muted groups,
 *                                starred and hidden messages, read positions
 *   chatReports/{id}             a member's report about a group
 *
 * A group is private: only its members can read it (`firestore.rules`), and
 * people get in by being added by an admin, as in WhatsApp. `memberIds`
 * exists beside `members` because it is what a query and a rule can test.
 *
 * This file runs in the web app and in the native app. On native the screens
 * are a page inside a WebView (`MessagingEmbed.tsx`) and reach it over the
 * bridge — see `embed/transport.web.ts`.
 */

const GROUPS = "chatGroups";
const FILES = "chatFiles";
const DIRECTORY = "chatDirectory";
const USERS = "chatUsers";
const REPORTS = "chatReports";

/** How much of each chat is kept in step: the latest messages. */
const HISTORY = 100;

type GroupDoc = Omit<Group, "id" | "members" | "requests" | "unread" | "muted" | "count"> & {
  members: Record<string, { name: string; role: Member["role"] }>;
  memberIds: string[];
};
type UserDoc = {
  muted?: string[];
  saved?: string[];
  hidden?: string[];
  read?: Record<string, number>;
};

const db = () => getFirestore(getApp());
const groupRef = (id: string) => doc(collection(db(), GROUPS), id);
const messageRef = (groupId: string, id: string) =>
  doc(collection(db(), `${GROUPS}/${groupId}/messages`), id);

/** Firestore refuses `undefined`; a message simply leaves those fields out. */
function clean<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ── Reading ────────────────────────────────────────────────────────────────

type Watch = {
  state: MessagingState | null;
  listeners: Set<(state: MessagingState) => void>;
  emit: () => void;
  stop: () => void;
};
const watches = new Map<string, Watch>();

const EMPTY: MessagingState = {
  version: 1,
  groups: [],
  messages: [],
  saved: [],
  hidden: [],
  reports: [],
};

function start(user: Identity): Watch {
  const groups = new Map<string, GroupDoc>();
  const messages = new Map<string, Message[]>();
  const streams = new Map<string, () => void>();
  let mine: UserDoc = {};
  let loaded = false;
  let stopped = false;

  const watch: Watch = {
    state: null,
    listeners: new Set(),
    emit: () => {
      if (!loaded) return;
      const read = mine.read ?? {};
      const muted = new Set(mine.muted ?? []);
      const list: Group[] = [...groups.entries()].map(([id, g]) => ({
        id,
        name: g.name,
        description: g.description,
        category: g.category,
        image: g.image,
        creator: g.creator,
        owner: g.owner,
        rules: g.rules,
        permissions: g.permissions,
        count: g.memberIds.length,
        members: g.memberIds.map((uid) => ({
          id: uid,
          name: g.members[uid]?.name ?? "Member",
          role: g.members[uid]?.role ?? "Member",
        })),
        requests: [],
        muted: muted.has(id),
        unread: (messages.get(id) ?? []).filter(
          (m) => m.sender !== user.id && m.kind !== "system" && m.at > (read[id] ?? 0),
        ).length,
      }));
      watch.state = {
        version: 1,
        groups: list,
        messages: [...messages.values()].flat().sort((a, b) => a.at - b.at),
        saved: mine.saved ?? [],
        hidden: mine.hidden ?? [],
        reports: [],
      };
      watch.listeners.forEach((listener) => listener(watch.state!));
    },
    stop: () => {
      stopped = true;
      stopGroups();
      stopMine();
      streams.forEach((stop) => stop());
      streams.clear();
    },
  };

  const follow = (groupId: string) => {
    if (streams.has(groupId)) return;
    streams.set(
      groupId,
      onSnapshot(
        query(
          collection(db(), `${GROUPS}/${groupId}/messages`),
          orderBy("at", "desc"),
          limit(HISTORY),
        ),
        (snap) => {
          messages.set(
            groupId,
            snap.docs.map((d) => ({ ...(d.data() as Omit<Message, "id">), id: d.id })),
          );
          watch.emit();
        },
        // A refused stream is dead for good, so it is started again while the
        // group is still ours. This happens to a group's creator: the group
        // shows up here from the local write before the server has it, and the
        // rules cannot find a group that is not there yet. (Removed from the
        // group instead: the groups listener drops it and nothing restarts.)
        () => {
          streams.delete(groupId);
          setTimeout(() => {
            if (!stopped && groups.has(groupId)) follow(groupId);
          }, 1500);
        },
      ),
    );
  };

  const stopGroups = onSnapshot(
    query(collection(db(), GROUPS), where("memberIds", "array-contains", user.id)),
    (snap) => {
      const present = new Set<string>();
      for (const d of snap.docs) {
        present.add(d.id);
        groups.set(d.id, d.data() as GroupDoc);
        follow(d.id);
      }
      for (const id of [...groups.keys()])
        if (!present.has(id)) {
          groups.delete(id);
          messages.delete(id);
          streams.get(id)?.();
          streams.delete(id);
        }
      loaded = true;
      watch.emit();
    },
    () => {
      // Offline with nothing cached, or signed out: show an empty list rather
      // than a spinner that never ends.
      loaded = true;
      watch.emit();
    },
  );

  const stopMine = onSnapshot(
    doc(collection(db(), USERS), user.id),
    (snap) => {
      mine = (snap && typeof snap.exists === "function" && snap.exists()
        ? (snap.data() as UserDoc)
        : {}) ?? {};
      watch.emit();
    },
    () => undefined,
  );

  return watch;
}

/** Follow this account's groups and their messages. Returns the unsubscribe. */
export function watch(user: Identity, onState: (state: MessagingState) => void): () => void {
  let entry = watches.get(user.id);
  if (!entry) {
    entry = start(user);
    watches.set(user.id, entry);
    void publishToDirectory(user).catch(() => undefined);
  }
  const current = entry;
  current.listeners.add(onState);
  if (current.state) onState(current.state);
  return () => {
    current.listeners.delete(onState);
    if (!current.listeners.size) {
      current.stop();
      watches.delete(user.id);
    }
  };
}

/** What is already known for this account — lets a newly opened screen start filled in. */
export function peek(uid: string): MessagingState | null {
  return watches.get(uid)?.state ?? null;
}

/** Send the last server-backed state again — undoes a change that was refused. */
export function refresh(uid: string) {
  watches.get(uid)?.emit();
}

export const emptyState = EMPTY;

// ── Writing ────────────────────────────────────────────────────────────────

export async function apply(user: Identity, ops: Op[]): Promise<void> {
  for (const op of ops) {
    const now = Date.now();
    switch (op.t) {
      case "createGroup": {
        const g = op.group;
        await setDoc(
          groupRef(g.id),
          clean({
            name: g.name,
            description: g.description,
            category: g.category,
            image: g.image,
            creator: g.creator,
            owner: user.id,
            rules: g.rules,
            permissions: g.permissions,
            members: { [user.id]: { name: user.name, role: "Service Provider" } },
            memberIds: [user.id],
            createdAt: now,
            updatedAt: now,
          }),
        );
        break;
      }
      case "updateGroup":
        await updateDoc(groupRef(op.id), { ...clean(op.fields), updatedAt: now });
        break;
      case "setMember":
        await updateDoc(groupRef(op.id), {
          [`members.${op.member.id}`]: { name: op.member.name, role: op.member.role },
          memberIds: arrayUnion(op.member.id),
          updatedAt: now,
        });
        break;
      case "removeMember":
        await updateDoc(groupRef(op.id), {
          [`members.${op.uid}`]: deleteField(),
          memberIds: arrayRemove(op.uid),
          updatedAt: now,
        });
        break;
      case "addMessage": {
        const { id, ...message } = op.message;
        await setDoc(messageRef(message.groupId, id), clean({ ...message, sender: user.id }));
        break;
      }
      case "updateMessage": {
        const fields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(op.fields))
          if (key !== "id") fields[key] = value === null ? deleteField() : value;
        await updateDoc(messageRef(op.groupId, op.id), fields);
        break;
      }
      case "deleteMessage":
        await deleteDoc(messageRef(op.groupId, op.id));
        break;
      case "userState": {
        const { t: _t, ...fields } = op;
        await setDoc(doc(collection(db(), USERS), user.id), clean(fields), { merge: true });
        break;
      }
      case "report":
        await setDoc(doc(collection(db(), REPORTS)), {
          groupId: op.groupId,
          reason: op.reason,
          at: op.at,
          by: user.id,
        });
        break;
    }
  }
}

// ── People ─────────────────────────────────────────────────────────────────

/**
 * List this account under its sign-in number so a group admin can add it.
 * Only the number's own account can write the entry (the rules check the
 * token), and nobody can list the directory — you have to know the number.
 */
export async function publishToDirectory(user: Identity): Promise<void> {
  const phone = getAuth(getApp()).currentUser?.phoneNumber;
  if (!phone || !user.name.trim() || user.name === "Guest") return;
  await setDoc(doc(collection(db(), DIRECTORY), phone), {
    uid: user.id,
    name: user.name,
    kind: user.provider ? "supplier" : "customer",
  });
}

/** The A-Z Globe account signed in with this number (`+94…`), if there is one. */
export async function findPerson(phone: string): Promise<Member | null> {
  const snap = await getDoc(doc(collection(db(), DIRECTORY), phone));
  if (!snap || typeof snap.exists !== "function" || !snap.exists()) return null;
  const person = snap.data() as { uid: string; name: string };
  return { id: person.uid, name: person.name, role: "Member" };
}

// ── Files ──────────────────────────────────────────────────────────────────

export type StoredFile = { groupId: string; mime: string; data: string };

export async function putFile(user: Identity, id: string, file: StoredFile): Promise<void> {
  await setDoc(doc(collection(db(), FILES), id), { ...file, sender: user.id, at: Date.now() });
}

export async function getFile(id: string): Promise<{ mime: string; data: string } | null> {
  const snap = await getDoc(doc(collection(db(), FILES), id));
  if (!snap || typeof snap.exists !== "function" || !snap.exists()) return null;
  const file = snap.data() as StoredFile;
  return { mime: file.mime, data: file.data };
}

export async function removeFiles(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => deleteDoc(doc(collection(db(), FILES), id)).catch(() => undefined)),
  );
}
