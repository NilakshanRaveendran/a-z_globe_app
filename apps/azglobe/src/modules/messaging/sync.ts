import type { Group, Identity, Member, Message, MessagingState } from "./model";

/**
 * The screens change messaging state by returning a whole new state from the
 * old one. When groups are shared (Firebase configured), each change has to
 * become a write to the one document it touches — sending the whole state
 * back would overwrite what other members did in the meantime. `diffState`
 * turns "before" and "after" into that list of writes.
 */
export type GroupInfo = Pick<
  Group,
  "name" | "description" | "category" | "image" | "rules" | "permissions"
>;

export type Op =
  | { t: "createGroup"; group: Group }
  | { t: "updateGroup"; id: string; fields: Partial<GroupInfo> }
  | { t: "setMember"; id: string; member: Member }
  | { t: "removeMember"; id: string; uid: string }
  | { t: "addMessage"; message: Message }
  /** A `null` value clears the field. */
  | { t: "updateMessage"; groupId: string; id: string; fields: Record<string, unknown> }
  | { t: "deleteMessage"; groupId: string; id: string }
  | {
      t: "userState";
      muted?: string[];
      saved?: string[];
      hidden?: string[];
      /** Group id → when it was last read. */
      read?: Record<string, number>;
    }
  | { t: "report"; groupId: string; reason: string; at: number };

const INFO: (keyof GroupInfo)[] = [
  "name",
  "description",
  "category",
  "image",
  "rules",
  "permissions",
];

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function diffState(prev: MessagingState, next: MessagingState, user: Identity): Op[] {
  const created: Op[] = [];
  const info: Op[] = [];
  const added: Op[] = [];
  const removed: Op[] = [];
  const read: Record<string, number> = {};

  const before = new Map(prev.groups.map((g) => [g.id, g]));
  for (const group of next.groups) {
    const old = before.get(group.id);
    if (old === group) continue;
    if (!old) {
      if (group.owner === user.id) created.push({ t: "createGroup", group });
      continue;
    }
    const fields: Partial<GroupInfo> = {};
    for (const key of INFO)
      if (!same(old[key], group[key])) (fields as Record<string, unknown>)[key] = group[key];
    if (Object.keys(fields).length) info.push({ t: "updateGroup", id: group.id, fields });

    const oldMembers = new Map(old.members.map((m) => [m.id, m]));
    for (const member of group.members)
      if (!same(oldMembers.get(member.id), member))
        added.push({ t: "setMember", id: group.id, member });
    const kept = new Set(group.members.map((m) => m.id));
    for (const member of old.members)
      if (!kept.has(member.id)) removed.push({ t: "removeMember", id: group.id, uid: member.id });

    if (group.unread < old.unread) read[group.id] = Date.now();
  }

  const messages: Op[] = [];
  const beforeMessages = new Map(prev.messages.map((m) => [m.id, m]));
  const after = new Set<string>();
  for (const message of next.messages) {
    after.add(message.id);
    const old = beforeMessages.get(message.id);
    if (old === message) continue;
    if (!old) {
      messages.push({ t: "addMessage", message });
      continue;
    }
    const fields: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(old), ...Object.keys(message)])) {
      const a = (old as Record<string, unknown>)[key];
      const b = (message as Record<string, unknown>)[key];
      if (!same(a, b)) fields[key] = b === undefined ? null : b;
    }
    if (Object.keys(fields).length)
      messages.push({ t: "updateMessage", groupId: message.groupId, id: message.id, fields });
  }
  for (const message of prev.messages)
    if (!after.has(message.id))
      messages.push({ t: "deleteMessage", groupId: message.groupId, id: message.id });

  const mine: Extract<Op, { t: "userState" }> = { t: "userState" };
  const mutedOf = (s: MessagingState) => s.groups.filter((g) => g.muted).map((g) => g.id);
  if (!same(mutedOf(prev), mutedOf(next))) mine.muted = mutedOf(next);
  if (!same(prev.saved, next.saved)) mine.saved = next.saved;
  if (!same(prev.hidden, next.hidden)) mine.hidden = next.hidden;
  if (Object.keys(read).length) mine.read = read;

  const reports: Op[] = next.reports
    .slice(prev.reports.length)
    .map((r) => ({ t: "report", ...r }));

  // Order matters: a group exists before anything is posted in it, and a
  // member's parting message is written while they are still a member.
  return [
    ...created,
    ...info,
    ...added,
    ...messages,
    ...removed,
    ...(Object.keys(mine).length > 1 ? [mine] : []),
    ...reports,
  ];
}

/** Sri Lankan numbers as people type them → the form Firebase Auth stores. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const local = digits.replace(/^\+/, "").replace(/^94/, "").replace(/^0/, "");
  return /^\d{9}$/.test(local) ? `+94${local}` : null;
}
