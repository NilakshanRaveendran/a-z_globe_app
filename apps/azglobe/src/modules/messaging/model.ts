export const categories = [
  "All",
  "Food",
  "Events",
  "Hotels",
  "Home Services",
  "Business",
  "Jobs",
  "Travel",
  "Community",
] as const;
export type Identity = { id: string; name: string; provider: boolean };
export type Member = {
  id: string;
  name: string;
  role: "Service Provider" | "Admin" | "Member";
};
export type Group = {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  creator: string;
  owner: string;
  count: number;
  rules: string;
  members: Member[];
  requests: Member[];
  unread: number;
  muted: boolean;
  permissions: {
    posting: "everyone" | "admins";
    editing: "admins" | "everyone";
    joining: "anyone" | "approval";
    polls: boolean;
    events: boolean;
  };
};
export type Attachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  url?: string;
  duration?: number;
};
export type Message = {
  id: string;
  groupId: string;
  sender: string;
  name: string;
  text: string;
  at: number;
  kind:
    | "text"
    | "media"
    | "document"
    | "voice"
    | "location"
    | "poll"
    | "event"
    | "system"
    | "deleted";
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  edited?: boolean;
  replyTo?: string;
  forwarded?: boolean;
  attachments?: Attachment[];
  location?: { name: string; lat: number; lng: number };
  poll?: {
    options: string[];
    multiple: boolean;
    votes: Record<string, number[]>;
  };
  event?: {
    title: string;
    start: string;
    end: string;
    location: string;
    description: string;
    responses: Record<string, string>;
  };
  reactions: Record<string, string[]>;
};
export type MessagingState = {
  version: 1;
  groups: Group[];
  messages: Message[];
  saved: string[];
  hidden: string[];
  reports: { groupId: string; reason: string; at: number }[];
};

export const memberOf = (group: Group, user: Identity) =>
  group.members.some((m) => m.id === user.id);
export const adminOf = (group: Group, user: Identity) =>
  group.owner === user.id ||
  group.members.some((m) => m.id === user.id && m.role === "Admin");
export const canManage = (group: Group, user: Identity) =>
  user.provider && group.owner === user.id;
export const canEditInfo = (group: Group, user: Identity) =>
  memberOf(group, user) &&
  (adminOf(group, user) || group.permissions.editing === "everyone");
export function canSend(
  group: Group,
  user: Identity,
  kind: Message["kind"] = "text",
) {
  return (
    memberOf(group, user) &&
    (group.permissions.posting === "everyone" || adminOf(group, user)) &&
    (kind !== "poll" || group.permissions.polls || adminOf(group, user)) &&
    (kind !== "event" || group.permissions.events || adminOf(group, user))
  );
}
export function joinGroup(group: Group, user: Identity): Group {
  if (memberOf(group, user) || group.requests.some((m) => m.id === user.id))
    return group;
  const member: Member = { id: user.id, name: user.name, role: "Member" };
  return group.permissions.joining === "approval"
    ? { ...group, requests: [...group.requests, member] }
    : { ...group, count: group.count + 1, members: [...group.members, member] };
}
export function createGroup(
  user: Identity,
  input: Pick<
    Group,
    "name" | "description" | "category" | "image" | "permissions"
  >,
): Group {
  if (!user.provider)
    throw new Error("Only service providers can create A-Z Groups.");
  if (
    !input.name.trim() ||
    !input.description.trim() ||
    !categories.slice(1).includes(input.category as never)
  )
    throw new Error("Complete the group name, description and category.");
  return {
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
    id: `g-${crypto.randomUUID()}`,
    owner: user.id,
    creator: user.name,
    count: 1,
    rules: "Be respectful. Keep conversations relevant. No spam.",
    members: [{ id: user.id, name: user.name, role: "Service Provider" }],
    requests: [],
    unread: 0,
    muted: false,
  };
}
export function vote(
  message: Message,
  user: Identity,
  option: number,
): Message {
  if (!message.poll || option < 0 || option >= message.poll.options.length)
    return message;
  const selected = message.poll.votes[user.id] ?? [];
  const next = selected.includes(option)
    ? selected.filter((i) => i !== option)
    : message.poll.multiple
      ? [...selected, option]
      : [option];
  return {
    ...message,
    poll: {
      ...message.poll,
      votes: { ...message.poll.votes, [user.id]: next },
    },
  };
}
export function reactTo(
  message: Message,
  user: Identity,
  emoji: string,
): Message {
  const reactions = Object.fromEntries(
    Object.entries(message.reactions).map(([key, ids]) => [
      key,
      ids.filter((id) => id !== user.id),
    ]),
  );
  if (!message.reactions[emoji]?.includes(user.id))
    reactions[emoji] = [...(reactions[emoji] ?? []), user.id];
  return {
    ...message,
    reactions: Object.fromEntries(
      Object.entries(reactions).filter(([, ids]) => ids.length),
    ),
  };
}
// ── Files ─────────────────────────────────────────────────────────────────
// Any file can be shared. These decide how each one is shown: photos and videos
// inline, audio as a player, PDFs and text in the viewer, everything else as a
// typed card that opens or downloads. Browsers leave `File.type` empty for many
// formats (Markdown, HEIC, Office on some systems), so the extension decides
// when the MIME type doesn't.

export type FileKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "other";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", heic: "image/heic", heif: "image/heif",
  bmp: "image/bmp", svg: "image/svg+xml", tif: "image/tiff", tiff: "image/tiff",
  mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", webm: "video/webm",
  mkv: "video/x-matroska", avi: "video/x-msvideo", "3gp": "video/3gpp",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", flac: "audio/flac",
  amr: "audio/amr", weba: "audio/webm", mid: "audio/midi", midi: "audio/midi",
  pdf: "application/pdf",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", tsv: "text/tab-separated-values",
  json: "application/json", xml: "application/xml", html: "text/html", htm: "text/html",
  log: "text/plain", rtf: "application/rtf", ics: "text/calendar", vcf: "text/vcard",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text", pages: "application/vnd.apple.pages",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet", numbers: "application/vnd.apple.numbers",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation", key: "application/vnd.apple.keynote",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  tar: "application/x-tar", gz: "application/gzip",
  epub: "application/epub+zip", apk: "application/vnd.android.package-archive",
};

/** Plain-text formats the viewer can show as text (read as UTF-8). */
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "csv", "tsv", "json", "xml", "log", "ics", "vcf", "yml", "yaml",
  "ini", "js", "ts", "tsx", "jsx", "py", "java", "kt", "swift", "c", "cpp", "h",
  "cs", "go", "rs", "rb", "php", "sh", "sql", "css", "srt", "vtt",
]);

/** Lower-case extension without the dot, or "" when there is none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : "";
}

/** The browser's type when it gave a useful one, otherwise one from the extension. */
export function mimeFor(name: string, type = ""): string {
  const given = type.split(";")[0]!.trim().toLowerCase();
  if (given && given !== "application/octet-stream") return given;
  return MIME_BY_EXTENSION[extensionOf(name)] ?? "application/octet-stream";
}

export function fileKind(file: { name: string; mime?: string }): FileKind {
  const mime = mimeFor(file.name, file.mime);
  const ext = extensionOf(file.name);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (/spreadsheet|excel|numbers|text\/csv|tab-separated/.test(mime)) return "spreadsheet";
  if (/presentation|powerpoint|keynote/.test(mime)) return "presentation";
  if (/zip|rar|7z|tar|gzip|compressed|package-archive/.test(mime) && !/epub/.test(mime)) return "archive";
  if (/word|opendocument\.text|apple\.pages|rtf|epub/.test(mime)) return "document";
  if (mime.startsWith("text/") || /json|xml/.test(mime) || TEXT_EXTENSIONS.has(ext)) return "text";
  return "other";
}

/** The badge on a file card: its extension ("PDF", "DOCX"), or the kind. */
export function fileBadge(file: { name: string; mime?: string }): string {
  const ext = extensionOf(file.name);
  if (ext && ext.length <= 4) return ext.toUpperCase();
  return ({ image: "IMG", video: "VID", audio: "AUD", pdf: "PDF", text: "TXT" } as Record<string, string>)[
    fileKind(file)
  ] ?? "FILE";
}

/** "0 B", "812 B", "1.2 KB", "3.4 MB", "1.1 GB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Photos and videos show inline; everything else is a card or a player. */
export function isVisual(file: { name: string; mime?: string }): boolean {
  const kind = fileKind(file);
  return kind === "image" || kind === "video";
}

/** What a message with attachments reads as in the chat list and replies. */
export function attachmentSummary(files: Attachment[]): string {
  if (!files.length) return "Attachment";
  const kinds = files.map(fileKind);
  const n = files.length;
  const all = (k: FileKind) => kinds.every((x) => x === k);
  if (all("image")) return n === 1 ? "📷 Photo" : `📷 ${n} photos`;
  if (all("video")) return n === 1 ? "🎬 Video" : `🎬 ${n} videos`;
  if (kinds.every((k) => k === "image" || k === "video")) return `🖼️ ${n} photos & videos`;
  if (n > 1) return `📎 ${n} files`;
  const first = files[0]!;
  if (kinds[0] === "audio") return `🎵 ${first.name}`;
  return `📄 ${first.name}`;
}

export function preview(message?: Message) {
  if (!message) return "Start a conversation";
  if (message.kind === "deleted") return "This message was deleted";
  if (message.text) return message.text;
  if (message.kind === "voice") return "🎤 Voice message";
  if (message.attachments?.length) return attachmentSummary(message.attachments);
  return (
    (
      {
        media: "Photos & videos",
        document: "File",
        location: "📍 Location",
        poll: "📊 Poll",
        event: message.event?.title ?? "Event",
      } as Record<string, string>
    )[message.kind] || "Message"
  );
}

export function seedState(user: Identity): MessagingState {
  const names = [
    "Trincomalee Food Lovers",
    "A-Z Jobs & Opportunities",
    "Local Business Network",
    "Trincomalee Event Community",
    "Home Services Trincomalee",
    "Hotel & Travel Community",
    "Wedding & Decoration Community",
    "Funeral Services Community",
  ];
  const cats = [
    "Food",
    "Jobs",
    "Business",
    "Events",
    "Home Services",
    "Travel",
    "Events",
    "Community",
  ];
  const descriptions = [
    "Share restaurant recommendations, offers and food experiences around Trincomalee.",
    "Local vacancies, career advice and opportunities for your next step.",
    "Connect with local businesses, exchange ideas and find trusted partners.",
    "Meet event planners, decorators and suppliers in your community.",
    "Find trusted professionals for repairs, cleaning and home improvements.",
    "Discover places to stay, weekend escapes and local travel advice.",
    "Bring your celebrations to life with local wedding professionals.",
    "A respectful space for practical support, services and community notices.",
  ];
  const people: Member[] = [
    { id: "nimal", name: "Nimal Fernando", role: "Service Provider" },
    { id: "kasun", name: "Kasun Perera", role: "Admin" },
    { id: "priya", name: "Priya Selvaraj", role: "Member" },
  ];
  const now = Date.now();
  const groups: Group[] = names.map((name, i) => ({
    id: `group-${i}`,
    name,
    description: descriptions[i]!,
    category: cats[i]!,
    image: i === 0 ? "food" : i === 5 ? "hotel" : "",
    creator:
      i === 0
        ? "Yaal Angaadi"
        : ["Nimal Fernando", "A-Z Careers", "Trinco Business Hub"][i % 3]!,
    owner: "nimal",
    count: [1248, 816, 342, 624, 287, 932, 418, 156][i]!,
    rules:
      "Be kind and respectful. Keep posts relevant to the group. No spam, unsolicited promotions or personal information.",
    members: [
      ...people,
      ...(i < 3
        ? [{ id: user.id, name: user.name, role: "Member" as const }]
        : []),
    ],
    requests: [],
    unread: i === 0 ? 8 : i === 2 ? 4 : 0,
    muted: false,
    permissions: {
      posting: i === 1 ? "admins" : "everyone",
      editing: "admins",
      joining: i === 6 ? "approval" : "anyone",
      polls: true,
      events: true,
    },
  }));
  const messages: Message[] = [];
  groups.forEach((group, i) => {
    const base = (
      id: string,
      sender: string,
      text: string,
      kind: Message["kind"] = "text",
      extra: Partial<Message> = {},
    ): Message => ({
      id: `${group.id}-${id}`,
      groupId: group.id,
      sender,
      name:
        sender === user.id
          ? user.name
          : (people.find((p) => p.id === sender)?.name ?? "A-Z Groups"),
      text,
      kind,
      at: now - 86400000 + messages.length * 60000,
      reactions: {},
      ...extra,
    });
    messages.push(
      base(
        "welcome",
        "nimal",
        `Welcome to ${group.name}. Keep it local, helpful and respectful.`,
        "system",
      ),
    );
    if (i === 0 || i === 3) {
      messages.push(
        base(
          "question",
          "kasun",
          "Does anyone know a good decorator available this Saturday?",
          "text",
          { reactions: { "👍": ["nimal", "priya"] } },
        ),
      );
      messages.push(
        base(
          "reply",
          "nimal",
          "Try Royal Decorations. I used them last month.",
          "text",
          { replyTo: `${group.id}-question` },
        ),
      );
      messages.push(
        base("mine", user.id, "Do they handle outdoor events too?", "text", {
          status: "read",
        }),
      );
      messages.push(
        base("yes", "kasun", "Yes, they do. The setup looked lovely!", "text"),
      );
      messages.push(
        base(
          "photo",
          "priya",
          "A little inspiration for our next meetup.",
          "media",
          {
            attachments: [
              {
                id: "sample-food",
                name: "Lunch together.jpg",
                mime: "image/jpeg",
                size: 71000,
                url: "food",
              },
            ],
          },
        ),
      );
      messages.push(
        base(
          "document",
          "nimal",
          "Here is our supplier shortlist.",
          "document",
          {
            attachments: [
              {
                id: "sample-document",
                name: "Supplier List.txt",
                mime: "text/plain",
                size: 128,
                url: "sample-document",
              },
            ],
          },
        ),
      );
      messages.push(
        base("voice", "kasun", "", "voice", {
          attachments: [
            {
              id: "sample-voice",
              name: "Community meetup voice note",
              mime: "audio/mp4",
              size: 51665,
              url: "sample-voice",
              duration: 8,
            },
          ],
        }),
      );
      messages.push(
        base("poll", "kasun", "Where should we meet?", "poll", {
          at: now - 7200000,
          poll: {
            options: ["GR Plaza", "Dutch Bay", "Town Area"],
            multiple: true,
            votes: { nimal: [0], priya: [1], kasun: [0, 1] },
          },
        }),
      );
      const start = new Date(now + 3 * 86400000);
      start.setHours(18, 0, 0, 0);
      messages.push(
        base("event", "nimal", "", "event", {
          at: now - 5400000,
          event: {
            title: "Community Business Meetup",
            start: start.toISOString(),
            end: new Date(+start + 7200000).toISOString(),
            location: "GR Plaza, Trincomalee",
            description:
              "An evening of introductions, ideas and good food. Everyone is welcome.",
            responses: { nimal: "Going", priya: "Maybe" },
          },
        }),
      );
      messages.push(
        base("location", "kasun", "", "location", {
          at: now - 4200000,
          location: {
            name: "Dutch Bay, Trincomalee",
            lat: 8.5715,
            lng: 81.2385,
          },
        }),
      );
      messages.push(
        base(
          "link",
          "priya",
          "Useful local information: https://www.srilanka.travel/",
          "text",
          { at: now - 3600000 },
        ),
      );
      messages.push(
        base("last", "nimal", "Anyone available for tomorrow?", "text", {
          at: now - 120000,
        }),
      );
    } else
      messages.push(
        base(
          "last",
          "nimal",
          i === 1
            ? "New vacancies have been posted. Share your experience and availability with the community."
            : "Anyone available for tomorrow?",
          "text",
          { at: now - (i + 1) * 900000 },
        ),
      );
  });
  return { version: 1, groups, messages, saved: [], hidden: [], reports: [] };
}
