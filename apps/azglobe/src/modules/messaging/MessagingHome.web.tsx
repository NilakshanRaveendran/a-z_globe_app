import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@app/navigation/types";
import {
  categories,
  createGroup,
  memberOf,
  preview,
  type Group,
  type Message,
} from "./model";
import { useGroupSession } from "./session.web";
import {
  Avatar,
  Empty,
  Frame,
  Header,
  IconButton,
  MIcon,
  Primary,
  time,
} from "./ui.web";
import { GroupForm } from "./forms.web";

type Filter = "All" | "Unread" | "Joined" | "Discover";
const FILTERS: Filter[] = ["All", "Unread", "Joined", "Discover"];

/** WhatsApp's list stamp: the time today, "Yesterday", then a short date. */
function stamp(at: number): string {
  const d = new Date(at);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return time(at);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * Messages — the A-Z Groups list, laid out like WhatsApp's Chats screen:
 *
 *   header   "Messages" (+ back where the stack has one)
 *   search   an always-there pill — filters the list as you type
 *   filters  All · Unread (count) · Joined · Discover; Discover adds the
 *            category chips
 *   rows     flat, full-width: 52pt avatar · name + time on the first line ·
 *            ticks / sender + last message + unread badge (or muted) on the
 *            second · a hairline divider from the text column, as WhatsApp
 *   join     a group you are not in is the same row: members and category on
 *            the second line, a small "Join" tag where the badge would be
 *   new      providers get WhatsApp's floating button to create a group
 */
export function MessagingHome({ onBack }: { onBack?: () => void }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, state, update } = useGroupSession();
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [creating, setCreating] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  // Each filter starts at the top of its own list.
  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [filter, category]);

  const open = (g: Group) =>
    navigation.navigate("Messaging", { groupId: g.id });
  const lastOf = (g: Group): Message | undefined =>
    state.messages
      .filter((m) => m.groupId === g.id && !state.hidden.includes(m.id))
      .at(-1);
  const unreadCount = state.groups.filter(
    (g) => memberOf(g, user) && g.unread > 0,
  ).length;

  const q = query.trim().toLowerCase();
  const groups = state.groups
    .filter((g) => {
      const joined = memberOf(g, user);
      if (filter === "Unread" && !(joined && g.unread > 0)) return false;
      if (filter === "Joined" && !joined) return false;
      if (filter === "Discover" && (joined || (category !== "All" && g.category !== category)))
        return false;
      return `${g.name} ${g.description} ${g.category}`.toLowerCase().includes(q);
    })
    .sort((a, b) =>
      filter === "Discover"
        ? b.count - a.count
        : (lastOf(b)?.at ?? 0) - (lastOf(a)?.at ?? 0),
    );

  return (
    <Frame>
      <Header title="Messages" onBack={onBack} />
      <div className="azm-wa-top">
        <label className="azm-search azm-wa-search">
          <MIcon name="search" size={20} />
          <input
            placeholder="Search groups"
            aria-label="Search groups"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <IconButton name="close" label="Clear search" onClick={() => setQuery("")} />
          )}
        </label>
        <nav className="azm-wa-filters" aria-label="Filter groups">
          {FILTERS.map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === "Unread" && unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
          ))}
        </nav>
        {filter === "Discover" && (
          <div className="azm-wa-filters azm-wa-categories" aria-label="Group categories">
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="azm-scroll azm-wa-list" ref={list}>
        {!groups.length ? (
          <Empty
            title={
              q
                ? "No groups found"
                : filter === "Unread"
                  ? "You're all caught up"
                  : filter === "Joined"
                    ? "No groups yet"
                    : "No groups to discover"
            }
            text={
              q
                ? "Try another group name or keyword."
                : filter === "Unread"
                  ? "New messages in your groups will show here."
                  : "Join an A-Z Group and start connecting with your community."
            }
          >
            {!q && filter !== "Unread" && (
              <Primary
                onClick={() => {
                  setFilter("Discover");
                  setCategory("All");
                }}
              >
                Discover Groups
              </Primary>
            )}
          </Empty>
        ) : (
          groups.map((g) => {
            const joined = memberOf(g, user);
            const last = joined ? lastOf(g) : undefined;
            const unread = joined && g.unread > 0;
            const mine = last && last.sender === user.id && last.kind !== "system";
            return (
              <button
                key={g.id}
                className={`azm-wa-row ${unread ? "unread" : ""}`}
                onClick={() => open(g)}
                aria-label={`${joined ? "Open" : "View"} ${g.name}${unread ? `, ${g.unread} unread` : ""}`}
              >
                <Avatar name={g.name} image={g.image} />
                <span className="azm-wa-main">
                  <span className="azm-wa-line">
                    <strong className="azm-wa-name">{g.name}</strong>
                    {last && <time>{stamp(last.at)}</time>}
                  </span>
                  <span className="azm-wa-line">
                    {joined ? (
                      <span className="azm-wa-preview">
                        {mine && last.status && last.status !== "failed" && (
                          <span className={`azm-wa-tick ${last.status === "read" ? "read" : ""}`}>
                            <MIcon
                              name={last.status === "sent" || last.status === "sending" ? "sent" : "read"}
                              size={16}
                            />
                          </span>
                        )}
                        {last && last.kind !== "system" && !mine && (
                          <b>{last.name.split(" ")[0]}: </b>
                        )}
                        {last ? preview(last) : `${g.count.toLocaleString()} members`}
                      </span>
                    ) : (
                      <span className="azm-wa-preview">
                        {g.count.toLocaleString()} members · {g.category}
                      </span>
                    )}
                    {!joined ? (
                      <span className="azm-wa-join">Join</span>
                    ) : g.muted ? (
                      <span className="azm-wa-muted" aria-label="Muted">
                        <MIcon name="muted" size={16} />
                      </span>
                    ) : unread ? (
                      <span className="azm-wa-badge">{g.unread > 99 ? "99+" : g.unread}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })
        )}
        {groups.length > 0 && (
          <p className="azm-wa-note">
            <MIcon name="lock" size={12} /> A-Z Groups are saved on this device.
          </p>
        )}
      </div>

      {user.provider && (
        <button
          className="azm-wa-fab"
          aria-label="Create A-Z Group"
          onClick={() => setCreating(true)}
        >
          <MIcon name="add" size={26} />
        </button>
      )}

      {creating && user.provider && (
        <GroupForm
          onClose={() => setCreating(false)}
          onSave={(input) => {
            const group = createGroup(user, input);
            update((s) => ({ ...s, groups: [group, ...s.groups] }));
            setCreating(false);
            navigation.navigate("Messaging", {
              groupId: group.id,
              created: true,
            });
          }}
        />
      )}
    </Frame>
  );
}
