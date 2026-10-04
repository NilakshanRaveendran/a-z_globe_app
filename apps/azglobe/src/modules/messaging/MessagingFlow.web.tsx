import { Fragment, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@app/navigation/types";
import { MessagingHome } from "./MessagingHome.web";
import { useGroupSession } from "./session.web";
import { deleteFiles, findPerson, onSyncError, setFileGroup, sharedGroups } from "./store.web";
import {
  adminOf,
  canEditInfo,
  canManage,
  canSend,
  isVisual,
  joinGroup,
  memberOf,
  preview,
  reactTo,
  vote,
  type Attachment,
  type Group,
  type Member,
  type Message,
} from "./model";
import {
  Avatar,
  dateLabel,
  Empty,
  Field,
  Frame,
  Header,
  IconButton,
  MIcon,
  Primary,
  Sheet,
  time,
  type Glyph,
} from "./ui.web";
import { EventForm, GroupForm, LocationForm, PollForm } from "./forms.web";
import {
  FileMessage,
  MediaShare,
  MediaThumb,
  MediaViewer,
  VoiceRecorder,
} from "./media.web";
import { MessageBubble } from "./MessageBubble.web";
import { MessageMenu } from "./MessageMenu.web";

type Page = "chat" | "info" | "members" | "shared" | "events";
type Modal =
  | ""
  | "share"
  | "media"
  | "camera"
  | "document"
  | "audio"
  | "location"
  | "poll"
  | "event"
  | "menu"
  | "actions"
  | "emoji"
  | "reactions"
  | "votes"
  | "respond"
  | "deleteSelected"
  | "forward"
  | "messageInfo"
  | "saved"
  | "leave"
  | "report"
  | "editGroup"
  | "addPeople"
  | "member";
const reactions = ["👍", "❤️", "😂", "😮", "😢", "🙏", "😌"];

// The picker and its emoji data load when the emoji sheet first opens.
const EmojiPicker = lazy(() => import("./EmojiPicker.web").then((m) => ({ default: m.EmojiPicker })));

export function MessagingFlow() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Messaging">>();
  return route.params?.groupId ? (
    <GroupExperience
      key={route.params.groupId}
      groupId={route.params.groupId}
      created={route.params.created}
      onBack={() => navigation.goBack()}
    />
  ) : (
    <MessagingHome onBack={() => navigation.goBack()} />
  );
}

function GroupExperience({
  groupId,
  created,
  onBack,
}: {
  groupId: string;
  created?: boolean;
  onBack: () => void;
}) {
  const { user, state, update, loading } = useGroupSession();
  const group = state.groups.find((g) => g.id === groupId);
  const [memberId, setMemberId] = useState("");
  const [page, setPage] = useState<Page>("chat");
  const [modal, setModal] = useState<Modal>("");
  const [selectedId, setSelectedId] = useState("");
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const toggleSelection = (id: string) => {
    setModal("");
    setSelectionIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
    inputRef.current?.blur();
  };
  const [replyId, setReplyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [text, setText] = useState("");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState(0);
  const [memberQuery, setMemberQuery] = useState("");
  const [contentTab, setContentTab] = useState("Media");
  const [eventTab, setEventTab] = useState("Upcoming");
  const [reactionFilter, setReactionFilter] = useState("All");
  const [report, setReport] = useState("");
  const [toast, setToast] = useState("");
  const [joining, setJoining] = useState(false);
  const [success, setSuccess] = useState(!!created);
  const [highlight, setHighlight] = useState("");
  const [incoming, setIncoming] = useState<File[]>([]);
  const [viewer, setViewer] = useState<{
    files: Attachment[];
    index: number;
  }>();
  const [recording, setRecording] = useState<{
    pointer: { x: number; y: number } | null;
  }>();
  const [failed, setFailed] = useState<Message[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [showLatest, setShowLatest] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const initialUnread = useRef(group?.unread ?? 0);
  const previousCount = useRef(0);
  const joined = !!group && memberOf(group, user);
  const messages = [
    ...state.messages.filter(
      (m) => m.groupId === groupId && !state.hidden.includes(m.id),
    ),
    ...failed,
  ];
  const unreadStart = useRef(
    initialUnread.current ? messages.at(-initialUnread.current)?.id : undefined,
  );
  const selection = messages.filter((m) => selectionIds.includes(m.id) && m.kind !== "system");
  const selecting = selection.length > 0;
  const selected = messages.find((m) => m.id === selectedId);
  const forwarding = selecting ? selection.filter((m) => m.kind !== "deleted" && m.status !== "failed") : selected ? [selected] : [];
  useEffect(() => {
    if (!selecting) return;
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelectionIds([]); setModal(""); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [selecting]);
  const reply = messages.find((m) => m.id === replyId);
  const matches = query.trim()
    ? messages.filter(
        (m) =>
          m.kind !== "deleted" &&
          `${m.text} ${m.event?.title ?? ""} ${m.attachments?.map((f) => f.name).join(" ") ?? ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      )
    : [];
  const latest = () => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    atBottom.current = true;
    setNewCount(0);
    setShowLatest(false);
  };
  const notify = (message: string) => setToast(message);
  const commit = (fn: Parameters<typeof update>[0]) => {
    try {
      update(fn);
      return true;
    } catch {
      notify("Changes could not be saved. Check device storage and try again.");
      return false;
    }
  };
  const setGroup = (fn: (g: Group) => Group) =>
    commit((s) => ({
      ...s,
      groups: s.groups.map((g) => (g.id === groupId ? fn(g) : g)),
    }));
  const changeMessage = (id: string, fn: (m: Message) => Message) =>
    commit((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === id && m.groupId === groupId ? fn(m) : m,
      ),
    }));
  const jump = (id: string) => {
    document
      .getElementById(`message-${id}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlight(id);
  };
  // Files sent from this chat belong to this group; a change the server
  // refuses is said out loud rather than silently undone.
  useEffect(() => {
    setFileGroup(groupId);
    return onSyncError(setToast);
  }, [groupId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(""), 2200);
    return () => clearTimeout(t);
  }, [highlight]);
  useEffect(() => {
    if (page === "chat" && joined) {
      const r = requestAnimationFrame(latest);
      return () => cancelAnimationFrame(r);
    }
  }, [page, joined]);
  useEffect(() => {
    if (!joined || page !== "chat" || !group?.unread) return;
    setGroup((g) => ({ ...g, unread: 0 }));
  }, [joined, page, group?.unread]);
  useEffect(() => {
    if (page === "chat") {
      if (atBottom.current) requestAnimationFrame(latest);
      else if (messages.length > previousCount.current)
        setNewCount((n) => n + messages.length - previousCount.current);
    }
    previousCount.current = messages.length;
  }, [messages.length, page]);
  useEffect(() => {
    setMatch(0);
    if (matches[0]) jump(matches[0].id);
  }, [query]);
  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.style.height = "44px";
      input.style.height = `${Math.min(132, input.scrollHeight)}px`;
    }
  }, [text, page]);
  // Browser visual viewport follows the software keyboard without covering the composer.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () =>
      setKeyboardInset(
        Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
      );
    viewport.addEventListener("resize", resize);
    return () => viewport.removeEventListener("resize", resize);
  }, []);
  if (!group)
    return (
      <Frame>
        <Header title={loading ? "" : "Group unavailable"} onBack={onBack} />
        {!loading && <Empty title="This group is no longer available" />}
      </Frame>
    );
  /** A line in the chat that records what happened to the group, as WhatsApp does. */
  const systemMessage = (text: string): Message => ({
    id: crypto.randomUUID(),
    groupId,
    sender: user.id,
    name: user.name,
    text,
    kind: "system",
    at: Date.now(),
    reactions: {},
  });
  const addMember = (person: Member) =>
    commit((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === groupId && !g.members.some((m) => m.id === person.id)
          ? { ...g, count: g.count + 1, members: [...g.members, { ...person, role: "Member" }] }
          : g,
      ),
      messages: [...s.messages, systemMessage(`${user.name} added ${person.name}`)],
    }));
  const removeMember = (person: Member) =>
    commit((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === groupId
          ? { ...g, count: Math.max(1, g.count - 1), members: g.members.filter((m) => m.id !== person.id) }
          : g,
      ),
      messages: [...s.messages, systemMessage(`${user.name} removed ${person.name}`)],
    }));
  const setAdmin = (person: Member, admin: boolean) =>
    setGroup((g) => ({
      ...g,
      members: g.members.map((m) =>
        m.id === person.id ? { ...m, role: admin ? "Admin" : "Member" } : m,
      ),
    }));
  const member = group.members.find((m) => m.id === memberId);

  const send = (extra: Partial<Message> = {}) => {
    const kind = extra.kind ?? "text";
    if (!canSend(group, user, kind)) {
      notify("You do not have permission to send this message.");
      return;
    }
    // Only a text message takes the composer's draft; attachments, polls,
    // events and locations carry their own text (a caption, or none).
    const body = extra.text ?? (kind === "text" ? text.trim() : "");
    if (kind === "text" && !body) return;
    // Editing changes a text message — never turns it into an attachment or poll.
    if (editingId && kind === "text") {
      const existing = messages.find((m) => m.id === editingId);
      if (!existing || existing.sender !== user.id || existing.kind !== "text")
        return;
      if (
        changeMessage(editingId, (m) => ({ ...m, text: body, edited: true }))
      ) {
        setEditingId("");
        setText("");
      }
      return;
    }
    const message: Message = {
      ...extra,
      id: crypto.randomUUID(),
      groupId,
      sender: user.id,
      name: user.name,
      kind,
      text: body,
      at: Date.now(),
      reactions: {},
      status: "sent",
      replyTo: replyId || undefined,
    };
    if (!commit((s) => ({ ...s, messages: [...s.messages, message] })))
      setFailed((prev) => [...prev, { ...message, status: "failed" }]);
    setText("");
    setReplyId("");
    setModal("");
    setIncoming([]);
    setRecording(undefined);
    atBottom.current = true;
    requestAnimationFrame(latest);
  };
  const retry = (message: Message) => {
    if (!canSend(group, user, message.kind)) return;
    if (
      commit((s) => ({
        ...s,
        messages: [...s.messages, { ...message, status: "sent" }],
      }))
    )
      setFailed((prev) => prev.filter((m) => m.id !== message.id));
  };
  const join = async () => {
    setJoining(true);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const next = joinGroup(group, user);
    if (setGroup(() => next)) {
      if (memberOf(next, user)) {
        setPage("chat");
        notify(`You joined ${group.name}`);
        commit((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              groupId,
              sender: user.id,
              name: user.name,
              text: "You joined the group",
              kind: "system",
              at: Date.now(),
              reactions: {},
            },
          ],
        }));
      } else notify("Join request sent to the group admins.");
    }
    setJoining(false);
  };
  const openMenu = (m: Message) => {
    setSelectedId(m.id);
    setModal("actions");
  };
  const showInfo = () => {
    setModal("");
    setPage("info");
  };
  const closeModal = () => {
    setModal("");
    setIncoming([]);
  };
  /** Files pasted or dropped into the chat open the matching share sheet. */
  const receiveFiles = (files: File[]) => {
    if (!files.length || !canSend(group, user, "document")) return;
    setIncoming(files);
    setModal(files.every((f) => isVisual({ name: f.name, mime: f.type })) ? "media" : "document");
  };
  const action = (
    icon: Glyph,
    label: string,
    onClick: () => void,
    danger = false,
  ) => (
    <button className={`azm-action ${danger ? "red" : ""}`} onClick={onClick}>
      <span className="azm-action-icon">
        <MIcon name={icon} size={20} />
      </span>
      <span>{label}</span>
      <MIcon name="next" size={20} />
    </button>
  );
  const searchChat = () => {
    setPage("chat");
    setSearching(true);
    setModal("");
  };
  const back = () => {
    if (page !== "chat" && joined) setPage(page === "info" ? "chat" : "info");
    else onBack();
  };
  const react = (emoji: string) => {
    if (joined && selected && selected.kind !== "deleted")
      changeMessage(selected.id, (m) => reactTo(m, user, emoji));
    closeModal();
  };
  const shared = messages.filter((m) => m.kind !== "deleted");
  // Every attachment, whichever button sent it: photos and videos under Media,
  // everything else (PDFs, documents, audio, archives…) under Files.
  const attachments = shared
    .filter((m) => m.kind === "media" || m.kind === "document")
    .flatMap((m) => m.attachments ?? []);
  const media = attachments.filter((f) => isVisual(f));
  const documents = attachments.filter((f) => !isVisual(f));
  const links = shared.flatMap((m) =>
    (m.text.match(/https?:\/\/[^\s<>]+/g) ?? []).map((url) => ({
      id: m.id,
      url,
    })),
  );

  let content: ReactNode;
  if (success)
    content = (
      <>
        <Header title="Group Created" onBack={onBack} />
        <div className="azm-empty">
          <span className="azm-empty-icon red">
            <MIcon name="success" size={44} />
          </span>
          <h2>Group Created</h2>
          <p>Your A-Z Group is ready.</p>
          <Primary onClick={() => setSuccess(false)}>Open Group</Primary>
        </div>
      </>
    );
  else if (!joined || page === "info")
    content = (
      <>
        <Header title="Group Info" onBack={back}>
          {canEditInfo(group, user) && (
            <IconButton
              name="edit"
              label="Edit group"
              onClick={() => setModal("editGroup")}
            />
          )}
        </Header>
        <div className="azm-scroll azm-info-page">
          <div className="azm-group-hero">
            <Avatar name={group.name} image={group.image} large />
            <h2>{group.name}</h2>
            <div className="azm-group-meta">
              <span>
                <MIcon name="groups" size={15} />
                {group.count.toLocaleString()} members
              </span>
              <span className="red">{group.category}</span>
            </div>
          </div>
          {joined && (
            <div className="azm-quick">
              {(["search", "muted", "image", "event"] as Glyph[]).map(
                (icon, i) => (
                  <button
                    key={icon}
                    onClick={() => {
                      if (i === 0) searchChat();
                      if (i === 1) setGroup((g) => ({ ...g, muted: !g.muted }));
                      if (i === 2) setPage("shared");
                      if (i === 3) setPage("events");
                    }}
                  >
                    <MIcon name={icon} />
                    {
                      [
                        "Search",
                        group.muted ? "Unmute" : "Mute",
                        "Media",
                        "Events",
                      ][i]
                    }
                  </button>
                ),
              )}
            </div>
          )}
          <div className="azm-info-section">
            <h3 className="azm-label">About</h3>
            <p>{group.description}</p>
          </div>
          <div className="azm-info-section">
            <h3 className="azm-label">Created by</h3>
            <p>{group.creator}</p>
            <small>Service Provider</small>
          </div>
          <div className="azm-info-section">
            <h3 className="azm-label">Group rules</h3>
            <p>{group.rules}</p>
          </div>
          {joined ? (
            <div className="azm-actions">
              {action(
                "groups",
                `Members · ${group.count.toLocaleString()}`,
                () => setPage("members"),
              )}
              {action(
                group.muted ? "bell" : "muted",
                group.muted ? "Unmute Notifications" : "Mute Notifications",
                () => setGroup((g) => ({ ...g, muted: !g.muted })),
              )}
              {action("image", "Media, Links & Documents", () =>
                setPage("shared"),
              )}
              {action("event", "Events", () => setPage("events"))}
              {action("search", "Search Chat", searchChat)}
              {canManage(group, user) &&
                action("settings", "Manage Group", () => setModal("editGroup"))}
              {group.owner !== user.id &&
                action("leave", "Leave Group", () => setModal("leave"), true)}
              {action("report", "Report Group", () => setModal("report"), true)}
            </div>
          ) : (
            <div style={{ height: 16 }} />
          )}
        </div>
        {!joined && (
          <div className="azm-bottom">
            <p className="azm-join-note">
              <MIcon name="lock" size={14} />
              Join this group to view and participate in conversations.
            </p>
            <Primary
              disabled={joining || group.requests.some((m) => m.id === user.id)}
              onClick={() => void join()}
            >
              {joining
                ? "Joining..."
                : group.requests.some((m) => m.id === user.id)
                  ? "Request pending"
                  : group.permissions.joining === "approval"
                    ? "Request to Join"
                    : "Join Group"}
            </Primary>
          </div>
        )}
      </>
    );
  else if (page === "members")
    content = (
      <>
        <Header title="Members" onBack={back} />
        <div className="azm-padding">
          <div className="azm-search">
            <MIcon name="search" />
            <input
              aria-label="Search members"
              placeholder="Search Members"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="azm-scroll azm-padding">
          {adminOf(group, user) &&
            action("add", "Add people", () => setModal("addPeople"))}
          {group.members
            .filter((m) =>
              m.name.toLowerCase().includes(memberQuery.toLowerCase()),
            )
            .map((m) => (
              <div className="azm-member" key={m.id}>
                <Avatar name={m.name} />
                <div>
                  <strong>
                    {m.id === user.id ? `${m.name} (You)` : m.name}
                  </strong>
                  <small>
                    {m.id === group.owner
                      ? "Group admin · Creator"
                      : m.role === "Admin"
                        ? "Group admin"
                        : m.role}
                  </small>
                </div>
                {adminOf(group, user) && m.id !== user.id && m.id !== group.owner && (
                  <IconButton
                    name="more"
                    label={`Options for ${m.name}`}
                    onClick={() => {
                      setMemberId(m.id);
                      setModal("member");
                    }}
                  />
                )}
              </div>
            ))}
          {canManage(group, user) && group.requests.length > 0 && (
            <>
              <h3>Join Requests</h3>
              {group.requests.map((m) => (
                <div className="azm-member" key={m.id}>
                  <Avatar name={m.name} />
                  <div>{m.name}</div>
                  <IconButton
                    name="sent"
                    label={`Approve ${m.name}`}
                    onClick={() =>
                      setGroup((g) => ({
                        ...g,
                        count: g.count + 1,
                        members: [...g.members, m],
                        requests: g.requests.filter((p) => p.id !== m.id),
                      }))
                    }
                  />
                  <IconButton
                    name="close"
                    label={`Decline ${m.name}`}
                    onClick={() =>
                      setGroup((g) => ({
                        ...g,
                        requests: g.requests.filter((p) => p.id !== m.id),
                      }))
                    }
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </>
    );
  else if (page === "shared")
    content = (
      <>
        <Header title="Shared Content" onBack={back} />
        <div className="azm-tabs">
          {["Media", "Files", "Links"].map((t) => (
            <button
              key={t}
              className={contentTab === t ? "active" : ""}
              onClick={() => setContentTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="azm-scroll">
          {contentTab === "Media" ? (
            media.length ? (
              <div className="azm-gallery">
                {media.map((f, i) => (
                  <MediaThumb
                    key={`${f.id}-${i}`}
                    file={f}
                    onOpen={() => setViewer({ files: media, index: i })}
                  />
                ))}
              </div>
            ) : (
              <Empty title="No shared media yet" />
            )
          ) : contentTab === "Files" ? (
            documents.length ? (
              <div className="azm-padding azm-file-list">
                {documents.map((f, i) => (
                  <FileMessage
                    key={`${f.id}-${i}`}
                    file={f}
                    onOpen={() => setViewer({ files: documents, index: i })}
                  />
                ))}
              </div>
            ) : (
              <Empty title="No files yet" text="PDFs, documents, audio and other files shared here will be listed." />
            )
          ) : links.length ? (
            links.map((l, i) => (
              <a
                key={`${l.id}-${i}`}
                className="azm-action"
                href={l.url}
                target="_blank"
                rel="noreferrer"
              >
                <MIcon name="link" />
                <span style={{ overflowWrap: "anywhere" }}>{l.url}</span>
              </a>
            ))
          ) : (
            <Empty title="No links yet" />
          )}
        </div>
      </>
    );
  else if (page === "events") {
    const events = shared.filter(
      (m) =>
        m.event &&
        (eventTab === "Upcoming"
          ? +new Date(m.event.start) >= Date.now()
          : +new Date(m.event.start) < Date.now()),
    );
    content = (
      <>
        <Header title="Events" onBack={back} />
        <div className="azm-tabs">
          {["Upcoming", "Past"].map((t) => (
            <button
              key={t}
              className={eventTab === t ? "active" : ""}
              onClick={() => setEventTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="azm-scroll">
          {events.length ? (
            events.map((m) => (
              <button
                className="azm-row azm-event-row"
                key={m.id}
                onClick={() => {
                  setSelectedId(m.id);
                  setModal("respond");
                }}
              >
                <span className="azm-event-date" aria-hidden>
                  <b>
                    {new Date(m.event!.start).toLocaleDateString([], { month: "short" })}
                  </b>
                  <strong>{new Date(m.event!.start).getDate()}</strong>
                </span>
                <span className="azm-row-main">
                  <h3>{m.event!.title}</h3>
                  <p>
                    {dateLabel(+new Date(m.event!.start))} ·{" "}
                    {time(+new Date(m.event!.start))}
                  </p>
                  {m.event!.location && <small>{m.event!.location}</small>}
                </span>
                <span className={`azm-tag ${m.event!.responses[user.id] ? "" : "red"}`}>
                  {m.event!.responses[user.id] ?? "Respond"}
                </span>
              </button>
            ))
          ) : (
            <Empty title={`No ${eventTab.toLowerCase()} events`} />
          )}
        </div>
      </>
    );
  } else
    content = (
      <>
        {searching ? (
          <header className="azm-header">
            <IconButton
              name="back"
              label="Close chat search"
              onClick={() => {
                setSearching(false);
                setQuery("");
              }}
            />
            <div className="azm-search">
              <input
                autoFocus
                placeholder="Search messages..."
                aria-label="Search messages"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <IconButton
                name="close"
                label="Clear search"
                onClick={() => setQuery("")}
              />
            </div>
          </header>
        ) : (
          <header className="azm-header azm-chat-header">
            <IconButton name="back" label="Back to Messages" onClick={onBack} />
            <button
              className="azm-icon"
              aria-label="Group info"
              onClick={showInfo}
            >
              <Avatar name={group.name} image={group.image} />
            </button>
            <button className="azm-chat-title" onClick={showInfo}>
              <strong>{group.name}</strong>
              <small>{group.count.toLocaleString()} members</small>
            </button>
            <IconButton
              name="search"
              label="Search chat"
              onClick={searchChat}
            />
            <IconButton
              name="more"
              label="Group options"
              onClick={() => setModal("menu")}
            />
          </header>
        )}
        {searching && query && (
          <div
            className="azm-form-row"
            style={{ padding: "0 16px", flexShrink: 0 }}
          >
            <small style={{ flex: 1 }}>
              {matches.length
                ? `${match + 1} of ${matches.length}`
                : "No messages found"}
            </small>
            <IconButton
              name="up"
              label="Previous result"
              disabled={!matches.length}
              onClick={() => {
                const i = (match - 1 + matches.length) % matches.length;
                setMatch(i);
                jump(matches[i]!.id);
              }}
            />
            <IconButton
              name="down"
              label="Next result"
              disabled={!matches.length}
              onClick={() => {
                const i = (match + 1) % matches.length;
                setMatch(i);
                jump(matches[i]!.id);
              }}
            />
          </div>
        )}
        <div
          ref={listRef}
          className="azm-scroll azm-timeline"
          aria-label="Message history"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            const files = Array.from(e.dataTransfer.files);
            if (files.length) {
              e.preventDefault();
              receiveFiles(files);
            }
          }}
          onScroll={() => {
            const el = listRef.current;
            if (el) {
              atBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              setShowLatest(!atBottom.current);
              if (atBottom.current) setNewCount(0);
            }
          }}
        >
          {messages.length === 0 && (
            <Empty
              title="Start the conversation"
              text="Say hello to your group."
            />
          )}
          {messages.map((m, i) => (
            <Fragment key={m.id}>
              {(!i || dateLabel(m.at) !== dateLabel(messages[i - 1]!.at)) && (
                <div className="azm-date">
                  <span>{dateLabel(m.at)}</span>
                </div>
              )}
              {m.id === unreadStart.current && (
                <div className="azm-system unread">
                  {initialUnread.current} Unread Messages
                </div>
              )}
              <MessageBubble
                message={m}
                user={user}
                reply={messages.find((r) => r.id === m.replyTo)}
                selected={
                  highlight === m.id ||
                  (modal === "actions" && selectedId === m.id)
                }
                selectionMode={selecting}
                checked={selectionIds.includes(m.id)}
                starred={state.saved.includes(m.id)}
                onSelect={() => toggleSelection(m.id)}
                query={query}
                onMenu={() => openMenu(m)}
                onJump={jump}
                onReaction={() => {
                  setSelectedId(m.id);
                  setReactionFilter("All");
                  setModal("reactions");
                }}
                onVote={(option) => {
                  if (joined)
                    changeMessage(m.id, (message) =>
                      vote(message, user, option),
                    );
                }}
                onVotes={() => {
                  setSelectedId(m.id);
                  setModal("votes");
                }}
                onRespond={() => {
                  setSelectedId(m.id);
                  setModal("respond");
                }}
                onMedia={(index) =>
                  setViewer({ files: m.attachments ?? [], index })
                }
                onRetry={() => retry(m)}
              />
            </Fragment>
          ))}
        </div>
        {showLatest && !selecting && (
          <button
            className="azm-latest"
            aria-label="Scroll to latest messages"
            onClick={latest}
          >
            <MIcon name="down" />
            {newCount || ""}
          </button>
        )}
        {selecting ? (
          <footer className="azm-header azm-selection-bar" aria-label="Selected messages">
            <div className="azm-selection-title">
            <IconButton name="close" label="Cancel message selection" onClick={() => setSelectionIds([])} />
            <strong aria-live="polite">{selection.length} selected</strong>
            </div>
            <div className="azm-selection-actions" role="group" aria-label="Message selection actions">
            <button type="button" className="azm-selection-action" aria-label="Copy selected messages" onClick={() => {
              if (!navigator.clipboard) { notify("Clipboard unavailable"); return; }
              void navigator.clipboard.writeText(selection.map((m) => m.text || preview(m)).join("\n"))
                .catch(() => notify("Clipboard unavailable"));
            }} ><MIcon name="copy" size={22} /><span>Copy</span></button>
            <button type="button" className="azm-selection-action" aria-label="Forward selected messages" disabled={forwarding.length !== selection.length}
              onClick={() => setModal("forward")} ><MIcon name="forward" size={22} /><span>Forward</span></button>
            <button type="button" className="azm-selection-action" aria-label="Star selected messages" onClick={() => {
              if (commit((s) => ({ ...s, saved: [...new Set([...s.saved, ...selectionIds])] }))) {
                setSelectionIds([]);
              }
            }} ><MIcon name="star" size={22} /><span>Star</span></button>
            <button type="button" className="azm-selection-action danger" aria-label="Delete selected messages" onClick={() => setModal("deleteSelected")} ><MIcon name="delete" size={22} /><span>Delete</span></button>
            </div>
          </footer>
        ) : canSend(group, user) ? (
          <>
            {(reply || editingId) && (
              <div className="azm-reply-preview">
                <MIcon name={editingId ? "edit" : "reply"} />
                <div>
                  <strong>
                    {editingId ? "Edit message" : `Replying to ${reply?.name}`}
                  </strong>
                  <p>{reply ? preview(reply) : text}</p>
                </div>
                <IconButton
                  name="close"
                  label="Cancel reply or edit"
                  onClick={() => {
                    setReplyId("");
                    setEditingId("");
                    setText("");
                  }}
                />
              </div>
            )}
            {recording ? (
              <VoiceRecorder
                pointer={recording.pointer}
                onCancel={() => setRecording(undefined)}
                onSend={send}
              />
            ) : (
              <div
                className="azm-composer"
                style={
                  keyboardInset
                    ? { paddingBottom: keyboardInset + 10 }
                    : undefined
                }
              >
                <IconButton
                  name="add"
                  label="Share attachment"
                  onClick={() => setModal("share")}
                />
                <div className="azm-composer-field">
                  <textarea
                    ref={inputRef}
                    aria-label="Message"
                    placeholder="Message..."
                    rows={1}
                    maxLength={8000}
                    dir="auto"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onPaste={(e) => {
                      const files = Array.from(e.clipboardData.files);
                      if (files.length) {
                        e.preventDefault();
                        receiveFiles(files);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <IconButton
                    name="emoji"
                    label="Choose emoji"
                    onClick={() => {
                      setSelectedId("");
                      setModal("emoji");
                    }}
                  />
                </div>
                {text.length ? (
                  <IconButton
                    name="send"
                    label="Send message"
                    className="azm-send"
                    disabled={!text.trim()}
                    onClick={() => send()}
                  />
                ) : (
                  <IconButton
                    name="mic"
                    label="Record voice message"
                    className="azm-send"
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setRecording({ pointer: { x: e.clientX, y: e.clientY } });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setRecording({ pointer: null });
                      }
                    }}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="azm-notice">Only group admins can send messages.</div>
        )}
      </>
    );

  return (
    <Frame>
      {content}
      {toast && (
        <div className="azm-toast" role="status">
          {toast}
        </div>
      )}
      {modal === "share" && (
        <Sheet title="Share" onClose={closeModal}>
          <div className="azm-attachment-grid">
            {(
              [
                ["image", "Photos & Videos", "media"],
                ["camera", "Camera", "camera"],
                ["attach", "Files", "document"],
                ["audio", "Audio", "audio"],
                ["location", "Location", "location"],
                ["poll", "Poll", "poll"],
                ["event", "Event", "event"],
              ] as const
            )
              .filter(([, , kind]) =>
                canSend(
                  group,
                  user,
                  kind === "camera" ? "media" : kind === "audio" ? "document" : kind,
                ),
              )
              .map(([icon, label, kind]) => (
                <button key={kind} data-kind={kind} onClick={() => setModal(kind)}>
                  <MIcon name={icon} size={24} />
                  {label}
                </button>
              ))}
          </div>
        </Sheet>
      )}
      {(modal === "media" || modal === "camera" || modal === "document" || modal === "audio") && (
        <MediaShare kind={modal} initial={incoming} onClose={closeModal} onSend={send} />
      )}
      {modal === "poll" && canSend(group, user, "poll") && (
        <PollForm onClose={closeModal} onSend={send} />
      )}
      {modal === "event" && canSend(group, user, "event") && (
        <EventForm onClose={closeModal} onSend={send} />
      )}
      {modal === "location" && (
        <LocationForm onClose={closeModal} onSend={send} />
      )}
      {modal === "menu" && (
        <Sheet title="Group options" onClose={closeModal}>
          {action("info", "Group Info", showInfo)}
          {action("search", "Search Chat", searchChat)}
          {action(
            group.muted ? "bell" : "muted",
            group.muted ? "Unmute Notifications" : "Mute Notifications",
            () => {
              setGroup((g) => ({ ...g, muted: !g.muted }));
              closeModal();
            },
          )}
          {action("star", "Saved Messages", () => {
            setModal("saved");
          })}
          {group.owner !== user.id &&
            action("leave", "Leave Group", () => setModal("leave"), true)}
        </Sheet>
      )}
      {modal === "saved" && (
        <Sheet title="Saved Messages" onClose={closeModal}>
          {messages.filter(m => state.saved.includes(m.id)).length ? messages.filter(m => state.saved.includes(m.id)).map(m => <button key={m.id} className="azm-row" onClick={() => { closeModal(); jump(m.id); }}><MIcon name="star" /><span className="azm-row-main"><h3>{m.name}</h3><p>{preview(m)}</p></span></button>) : <Empty title="No saved messages yet" />}
        </Sheet>
      )}
      {modal === "actions" && selected && (
        <MessageMenu
          messageId={selected.id}
          own={selected.sender === user.id}
          reactions={reactions}
          current={
            Object.entries(selected.reactions ?? {}).find(([, people]) =>
              people.includes(user.id),
            )?.[0]
          }
          onReact={selected.kind !== "deleted" ? react : undefined}
          onMoreReactions={() => setModal("emoji")}
          onClose={closeModal}
          items={[
            selected.kind === "deleted"
              ? []
              : [
                  ...(canSend(group, user)
                    ? [
                        {
                          icon: "reply" as const,
                          label: "Reply",
                          onPress: () => {
                            setReplyId(selected.id);
                            setEditingId("");
                            setTimeout(() => inputRef.current?.focus(), 0);
                          },
                        },
                      ]
                    : []),
                  { icon: "forward" as const, label: "Forward", onPress: () => setModal("forward") },
                  {
                    icon: "copy" as const,
                    label: "Copy",
                    onPress: () => {
                      if (!navigator.clipboard) {
                        notify("Clipboard unavailable. Select the message text to copy.");
                        return;
                      }
                      void navigator.clipboard
                        .writeText(selected.text || preview(selected))
                        .catch(() => notify("Clipboard unavailable. Select the message text to copy."));
                    },
                  },
                  ...(selected.sender === user.id &&
                  selected.kind === "text" &&
                  canSend(group, user)
                    ? [
                        {
                          icon: "edit" as const,
                          label: "Edit",
                          onPress: () => {
                            setEditingId(selected.id);
                            setText(selected.text);
                            setReplyId("");
                            setTimeout(() => inputRef.current?.focus(), 0);
                          },
                        },
                      ]
                    : []),
                  { icon: "info" as const, label: "Info", onPress: () => setModal("messageInfo") },
                  {
                    icon: "star" as const,
                    label: state.saved.includes(selected.id) ? "Unstar" : "Star",
                    onPress: () =>
                      commit((s) => ({
                        ...s,
                        saved: s.saved.includes(selected.id)
                          ? s.saved.filter((id) => id !== selected.id)
                          : [...s.saved, selected.id],
                      })),
                  },
                ],
            [
              { icon: "success" as const, label: "Select", onPress: () => toggleSelection(selected.id) },
              {
                icon: "delete" as const,
                label: selected.sender === user.id && selected.kind !== "deleted" ? "Delete for me" : "Delete",
                danger: true,
                onPress: () => {
                  commit((s) => ({ ...s, hidden: [...s.hidden, selected.id] }));
                  setFailed((f) => f.filter((m) => m.id !== selected.id));
                },
              },
              ...(selected.sender === user.id && selected.kind !== "deleted"
                ? [
                    {
                      icon: "delete" as const,
                      label: "Delete for everyone",
                      danger: true,
                      onPress: () => {
                        // Its files go too, unless a forwarded copy still shows them.
                        const orphaned = (selected.attachments ?? [])
                          .map((a) => a.id)
                          .filter(
                            (id) =>
                              !state.messages.some(
                                (m) => m.id !== selected.id && m.attachments?.some((a) => a.id === id),
                              ),
                          );
                        if (
                          changeMessage(selected.id, (m) => ({
                            id: m.id,
                            groupId: m.groupId,
                            sender: m.sender,
                            name: m.name,
                            at: m.at,
                            kind: "deleted",
                            text: "",
                            reactions: {},
                            status: m.status,
                          }))
                        )
                          void deleteFiles(orphaned).catch(() => undefined);
                      },
                    },
                  ]
                : []),
            ],
          ]}
        />
      )}
      {modal === "emoji" && (
        <Sheet
          title={selected ? "React to message" : "Emoji"}
          onClose={closeModal}
        >
          <Suspense fallback={<p className="azm-loading">Loading emoji…</p>}>
            <EmojiPicker
              onSelect={(emoji) => {
                if (selected) react(emoji);
                else {
                  setText((t) => t + emoji);
                  closeModal();
                }
              }}
            />
          </Suspense>
        </Sheet>
      )}
      {modal === "reactions" && selected && (
        <Sheet title="Reactions" onClose={closeModal}>
          <div className="azm-chips">
            {["All", ...Object.keys(selected.reactions)].map((key) => (
              <button
                key={key}
                className={reactionFilter === key ? "active" : ""}
                onClick={() => setReactionFilter(key)}
              >
                {key}{" "}
                {key === "All"
                  ? Object.values(selected.reactions).flat().length
                  : selected.reactions[key]?.length}
              </button>
            ))}
          </div>
          {Object.entries(selected.reactions)
            .filter(
              ([emoji]) => reactionFilter === "All" || reactionFilter === emoji,
            )
            .flatMap(([emoji, ids]) =>
              ids.map((id) => (
                <div className="azm-member" key={`${emoji}-${id}`}>
                  <Avatar
                    name={
                      group.members.find((m) => m.id === id)?.name ?? "Member"
                    }
                  />
                  <div>
                    {id === user.id
                      ? "You"
                      : (group.members.find((m) => m.id === id)?.name ??
                        "Member")}
                  </div>
                  <span>{emoji}</span>
                </div>
              )),
            )}
        </Sheet>
      )}
      {modal === "votes" && selected?.poll && (
        <Sheet title="Poll votes" onClose={closeModal}>
          {selected.poll.options.map((option, i) => (
            <div className="azm-info-section" key={option}>
              <h3>{option}</h3>
              {Object.entries(selected.poll!.votes)
                .filter(([, choices]) => choices.includes(i))
                .map(([id]) => (
                  <p key={id}>
                    {id === user.id
                      ? "You"
                      : (group.members.find((m) => m.id === id)?.name ??
                        "Member")}
                  </p>
                ))}
            </div>
          ))}
        </Sheet>
      )}
      {modal === "respond" && selected?.event && (
        <Sheet title={selected.event.title} onClose={closeModal}>
          {["Going", "Maybe", "Not Going"].map((response) => (
            <button
              key={response}
              className="azm-action"
              onClick={() => {
                if (joined)
                  changeMessage(selected.id, (m) => ({
                    ...m,
                    event: {
                      ...m.event!,
                      responses: { ...m.event!.responses, [user.id]: response },
                    },
                  }));
                closeModal();
              }}
            >
              <MIcon
                name={
                  selected.event!.responses[user.id] === response
                    ? "success"
                    : "event"
                }
              />
              <span>{response}</span>
            </button>
          ))}
        </Sheet>
      )}
      {modal === "forward" && forwarding.length > 0 && (
        <Sheet title="Forward to a group" onClose={closeModal}>
          {state.groups
            .filter((g) => forwarding.every((m) => canSend(g, user, m.kind)))
            .map((g) => (
              <button
                className="azm-row"
                key={g.id}
                onClick={() => {
                  const forwarded = forwarding.map((item, index) => ({
                    ...item,
                    id: crypto.randomUUID(),
                    groupId: g.id,
                    sender: user.id,
                    name: user.name,
                    at: Date.now() + index,
                    status: "sent" as const,
                    reactions: {},
                    replyTo: undefined,
                    forwarded: true,
                    poll: item.poll
                      ? { ...item.poll, votes: {} }
                      : undefined,
                    event: item.event
                      ? { ...item.event, responses: {} }
                      : undefined,
                  }));
                  if (
                    commit((s) => ({
                      ...s,
                      messages: [...s.messages, ...forwarded],
                    }))
                  ) {
                    setSelectionIds([]);
                    closeModal();
                  }
                }}
              >
                <Avatar name={g.name} image={g.image} />
                <span>{g.name}</span>
              </button>
            ))}
        </Sheet>
      )}
      {modal === "deleteSelected" && selecting && (
        <Sheet title={`Delete ${selection.length} messages?`} onClose={closeModal}>
          <p>These messages will be removed from your view on this device.</p>
          <Primary onClick={() => {
            if (commit((s) => ({ ...s, hidden: [...new Set([...s.hidden, ...selectionIds])] }))) {
              setFailed((items) => items.filter((m) => !selectionIds.includes(m.id)));
              setSelectionIds([]); closeModal();
            }
          }}>Delete for me</Primary>
        </Sheet>
      )}
      {modal === "messageInfo" && selected && (
        <Sheet title="Message Info" onClose={closeModal}>
          <p>{selected.name}</p>
          <small>
            {dateLabel(selected.at)} · {time(selected.at)}
          </small>
          <div className="azm-info-section">
            <p>Status: {selected.status ?? "Received"}</p>
            <small>{sharedGroups() ? "Sent to everyone in this group" : "Stored on this device"}</small>
          </div>
        </Sheet>
      )}
      {modal === "leave" && (
        <Sheet title="Leave Group?" onClose={closeModal}>
          <p>
            {sharedGroups()
              ? `You will stop receiving messages from ${group.name}. An admin can add you again.`
              : `You can discover and join ${group.name} again.`}
          </p>
          <div className="azm-padding">
            <Primary
              onClick={() => {
                if (group.owner === user.id) return;
                if (
                  commit((s) => ({
                    ...s,
                    groups: s.groups.map((g) =>
                      g.id === groupId
                        ? {
                            ...g,
                            members: g.members.filter((m) => m.id !== user.id),
                            count: Math.max(0, g.count - 1),
                            unread: 0,
                          }
                        : g,
                    ),
                    messages: sharedGroups()
                      ? [...s.messages, systemMessage(`${user.name} left`)]
                      : s.messages,
                  }))
                ) {
                  if (sharedGroups()) {
                    onBack();
                    return;
                  }
                  setModal("");
                  setReplyId("");
                  setText("");
                  setPage("info");
                }
              }}
            >
              Leave Group
            </Primary>
          </div>
          <button className="azm-text-action" onClick={closeModal}>
            Cancel
          </button>
        </Sheet>
      )}
      {modal === "report" && (
        <Sheet title="Report Group" onClose={closeModal}>
          <Field label="Reason">
            <textarea
              placeholder="Tell us what happened"
              maxLength={1000}
              value={report}
              onChange={(e) => setReport(e.target.value)}
            />
          </Field>
          <Primary
            disabled={!report.trim()}
            onClick={() => {
              if (
                commit((s) => ({
                  ...s,
                  reports: [
                    ...s.reports,
                    { groupId, reason: report.trim(), at: Date.now() },
                  ],
                }))
              ) {
                closeModal();
                notify(
                  sharedGroups()
                    ? "Report sent."
                    : "Report saved on this device. Not sent to a moderation team.",
                );
              }
            }}
          >
            Save Report
          </Primary>
        </Sheet>
      )}
      {modal === "editGroup" && canEditInfo(group, user) && (
        <GroupForm
          group={group}
          canConfigure={canManage(group, user)}
          onClose={closeModal}
          onSave={(input) => {
            if (!canEditInfo(group, user)) return;
            if (
              setGroup((g) => ({
                ...g,
                name: input.name,
                description: input.description,
                category: input.category,
                image: input.image,
                permissions: canManage(g, user)
                  ? input.permissions
                  : g.permissions,
              }))
            ) {
              closeModal();
              notify("Group updated");
            }
          }}
        />
      )}
      {modal === "addPeople" && adminOf(group, user) && (
        <AddPeople
          group={group}
          onClose={closeModal}
          onAdd={(person) => {
            if (addMember(person)) {
              closeModal();
              notify(`${person.name} added`);
            }
          }}
        />
      )}
      {modal === "member" && member && adminOf(group, user) && (
        <Sheet title={member.name} onClose={closeModal}>
          <div className="azm-actions">
            {member.role === "Admin"
              ? action("person", "Dismiss as admin", () => {
                  setAdmin(member, false);
                  closeModal();
                })
              : action("starFilled", "Make group admin", () => {
                  setAdmin(member, true);
                  closeModal();
                })}
            {action(
              "delete",
              "Remove from group",
              () => {
                removeMember(member);
                closeModal();
              },
              true,
            )}
          </div>
        </Sheet>
      )}
      {viewer && (
        <MediaViewer
          files={viewer.files}
          initial={viewer.index}
          onClose={() => setViewer(undefined)}
        />
      )}
    </Frame>
  );
}

/**
 * Add someone to the group by their phone number — the number they sign in to
 * A-Z Globe with. There is no contact list to pick from: the directory can be
 * asked about one number at a time and nothing else.
 */
function AddPeople({
  group,
  onClose,
  onAdd,
}: {
  group: Group;
  onClose: () => void;
  onAdd: (person: Member) => void;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [person, setPerson] = useState<Member>();
  const find = async () => {
    setBusy(true);
    setError("");
    setPerson(undefined);
    try {
      const found = await findPerson(phone);
      if (!found)
        setError("No A-Z Globe account uses this number yet. Ask them to install the app and sign in.");
      else if (group.members.some((m) => m.id === found.id))
        setError(`${found.name} is already in this group.`);
      else setPerson(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not look up this number.");
    }
    setBusy(false);
  };
  return (
    <Sheet title="Add people" onClose={onClose}>
      <Field label="Phone number">
        <input
          type="tel"
          inputMode="tel"
          placeholder="077 123 4567"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setPerson(undefined);
            setError("");
          }}
        />
      </Field>
      {error && (
        <p role="alert" className="azm-error">
          {error}
        </p>
      )}
      {person ? (
        <>
          <div className="azm-member">
            <Avatar name={person.name} />
            <div>
              <strong>{person.name}</strong>
              <small>A-Z Globe account</small>
            </div>
          </div>
          <Primary onClick={() => onAdd(person)}>Add to group</Primary>
        </>
      ) : (
        <Primary disabled={busy || !phone.trim()} onClick={() => void find()}>
          {busy ? "Searching..." : "Find"}
        </Primary>
      )}
    </Sheet>
  );
}
