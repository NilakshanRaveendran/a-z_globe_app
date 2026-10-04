import { useEffect, useRef, type CSSProperties } from "react";
import Checkbox from "@mui/material/Checkbox";
import Radio from "@mui/material/Radio";
import { colors } from "@core/theme";
import type { Message, Identity } from "./model";
import { fileKind, isVisual, preview } from "./model";
import { Avatar, MIcon, time, toneFor } from "./ui.web";
import { AudioMessage, FileMessage, MediaThumb, VoiceMessage } from "./media.web";

export function Highlight({
  text,
  query = "",
}: {
  text: string;
  query?: string;
}) {
  // Matched with a case-insensitive pattern on the original text, so the
  // marks stay aligned even where lower-casing changes a character's length.
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "giu"));
  return (
    <>
      {parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}
    </>
  );
}
/** Only web URLs become links; never activate arbitrary URI schemes. */
export function linkParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = /(?:https?:\/\/|www\.)[^\s<>]+/gi;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    const label = match[0].replace(/[.,!?;:)\]}]+$/, "");
    try {
      const url = new URL(/^www\./i.test(label) ? `https://${label}` : label);
      parts.push(url.hostname.includes(".") ? { text: label, href: url.href } : { text: label });
    } catch { parts.push({ text: label }); }
    cursor = start + label.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function MessageText({ text, query }: { text: string; query?: string }) {
  return <>{linkParts(text).map((part, i) => part.href ? (
    <a key={i} className="azm-message-link" href={part.href} target="_blank" rel="noopener noreferrer">
      <Highlight text={part.text} query={query} />
    </a>
  ) : <Highlight key={i} text={part.text} query={query} />)}</>;
}

export function MessageBubble({
  message: m,
  user,
  reply,
  selected,
  selectionMode = false,
  checked = false,
  starred = false,
  onSelect,
  query,
  onMenu,
  onJump,
  onReaction,
  onVote,
  onVotes,
  onRespond,
  onMedia,
  onRetry,
}: {
  message: Message;
  user: Identity;
  reply?: Message;
  selected?: boolean;
  selectionMode?: boolean;
  checked?: boolean;
  starred?: boolean;
  onSelect: () => void;
  query?: string;
  onMenu: () => void;
  onJump: (id: string) => void;
  onReaction: () => void;
  onVote: (option: number) => void;
  onVotes: () => void;
  onRespond: () => void;
  onMedia: (index: number) => void;
  onRetry: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const stop = () => clearTimeout(timer.current);
  useEffect(() => stop, []);
  if (m.kind === "system")
    return (
      <div id={`message-${m.id}`} className="azm-system">
        {m.text}
      </div>
    );
  const own = m.sender === user.id;
  const deleted = m.kind === "deleted";
  return (
    <div
      id={`message-${m.id}`}
      className={`azm-message ${own ? "own" : ""} ${selected ? "selected" : ""} ${selectionMode ? "selecting" : ""} ${checked ? "checked" : ""}`}
      onClickCapture={(e) => {
        if (held.current) { held.current = false; e.preventDefault(); e.stopPropagation(); return; }
        if (selectionMode) { e.preventDefault(); e.stopPropagation(); onSelect(); }
      }}
    >
      {selectionMode && <button className="azm-select-check" role="checkbox" aria-checked={checked}
        aria-label={`Select message from ${m.name}: ${preview(m)}`} onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onSelect(); }
        }}>{checked ? <MIcon name="success" size={22} /> : <span className="azm-select-empty" />}</button>}
      {!own && <Avatar name={m.name} />}
      <div className="azm-message-wrap">
        <div
          className={`azm-bubble${deleted ? " azm-bubble-deleted" : ""}`}
          tabIndex={0}
          aria-label={`Message from ${m.name}: ${preview(m)}`}
          onKeyDown={(e) => {
            if (
              e.target === e.currentTarget &&
              (e.key === "Enter" || e.key === " ")
            ) {
              e.preventDefault();
              if (selectionMode) onSelect(); else onMenu();
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            stop();
            if (held.current) return;
            if (selectionMode) onSelect(); else onMenu();
          }}
          onPointerDown={(e) => {
            if (
              e.button !== 0 ||
              (e.target as HTMLElement).closest("audio,video,input,textarea")
            )
              return;
            stop();
            held.current = false;
            origin.current = { x: e.clientX, y: e.clientY };
            timer.current = setTimeout(() => { held.current = true; if (selectionMode) onSelect(); else onMenu(); }, 480);
          }}
          onPointerMove={(e) => {
            if (
              Math.abs(e.clientX - origin.current.x) +
                Math.abs(e.clientY - origin.current.y) >
              12
            )
              stop();
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={stop}
        >
          {!own && (
            <div className="azm-sender" style={{ color: toneFor(m.name).color }}>
              {m.name}
            </div>
          )}
          {m.forwarded && !deleted && (
            <small>
              <MIcon name="forward" size={12} /> Forwarded
            </small>
          )}
          {reply && !deleted && (
            <button className="azm-quote" onClick={() => onJump(reply.id)}>
              <strong>{reply.name}</strong>
              <span>{preview(reply)}</span>
            </button>
          )}
          {deleted ? (
            <p className="azm-deleted-message">
              <MIcon name="unavailable" size={18} /><span>Message deleted</span>
            </p>
          ) : (
            <>
              {(m.kind === "media" || m.kind === "document") &&
                (() => {
                  // Each attachment by its type, whichever button sent it:
                  // photos and videos in the grid, audio as a player, the rest
                  // as file cards. `i` stays the index into all attachments,
                  // which is what the viewer pages through.
                  const all = (m.attachments ?? []).map((file, i) => ({ file, i }));
                  const visual = all.filter(({ file }) => isVisual(file));
                  const rest = all.filter(({ file }) => !isVisual(file));
                  return (
                    <>
                      {visual.length > 0 && (
                        <div className={`azm-attachments ${visual.length === 1 ? "single" : ""}`}>
                          {visual.map(({ file, i }) => (
                            <MediaThumb key={file.id} file={file} onOpen={() => onMedia(i)} />
                          ))}
                        </div>
                      )}
                      {rest.map(({ file, i }) =>
                        fileKind(file) === "audio" ? (
                          <AudioMessage key={file.id} file={file} />
                        ) : (
                          <FileMessage key={file.id} file={file} onOpen={() => onMedia(i)} />
                        ),
                      )}
                    </>
                  );
                })()}
              {m.kind === "voice" && m.attachments?.[0] && (
                <VoiceMessage file={m.attachments[0]} />
              )}
              {m.kind === "location" && m.location && (
                <a
                  className="azm-location"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.openstreetmap.org/?mlat=${m.location.lat}&mlon=${m.location.lng}#map=16/${m.location.lat}/${m.location.lng}`}
                >
                  <span className="azm-location-map" aria-hidden>
                    <MIcon name="location" size={34} />
                  </span>
                  <span className="azm-location-body">
                    <h3>{m.location.name}</h3>
                    <small>View on map</small>
                  </span>
                </a>
              )}
              {m.text && (
                <p dir="auto">
                  <MessageText text={m.text} query={query} />
                </p>
              )}
              {m.poll && (
                <div className="azm-poll">
                  {m.poll.options.map((option, i) => {
                    const selected =
                      m.poll!.votes[user.id]?.includes(i) ?? false;
                    const count = Object.values(m.poll!.votes).filter((v) =>
                      v.includes(i),
                    ).length;
                    const Control = m.poll!.multiple ? Checkbox : Radio;
                    const voters = Object.values(m.poll!.votes).filter((v) => v.length).length;
                    return (
                      <button
                        key={i}
                        className={`azm-poll-option ${selected ? "active" : ""}`}
                        aria-pressed={selected}
                        onClick={() => onVote(i)}
                        style={
                          { "--pct": `${voters ? Math.round((count / voters) * 100) : 0}%` } as CSSProperties
                        }
                      >
                        <Control
                          checked={selected}
                          tabIndex={-1}
                          disableRipple
                          sx={{
                            padding: "2px",
                            pointerEvents: "none",
                            color: colors.textMuted,
                            "&.Mui-checked": { color: colors.primary },
                          }}
                          slotProps={{
                            input: { "aria-hidden": true, tabIndex: -1 },
                          }}
                        />
                        <span>{option}</span>
                        <small>{count}</small>
                      </button>
                    );
                  })}
                  <button className="azm-text-action" onClick={onVotes}>
                    {Object.values(m.poll.votes).filter((v) => v.length).length}{" "}
                    votes · View votes
                  </button>
                </div>
              )}
              {m.event && (
                <div className="azm-event">
                  <div className="azm-event-heading">
                    <span className="azm-event-date" aria-hidden>
                      <b>
                        {new Date(m.event.start).toLocaleDateString([], { month: "short" })}
                      </b>
                      <strong>{new Date(m.event.start).getDate()}</strong>
                    </span>
                    <div>
                      <h3>{m.event.title}</h3>
                      <div className="azm-event-meta">
                        <MIcon name="event" size={14} />
                        {new Date(m.event.start).toLocaleDateString([], {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {time(+new Date(m.event.start))}
                      </div>
                    </div>
                  </div>
                  {m.event.location && (
                    <div className="azm-event-meta">
                      <MIcon name="location" size={14} />
                      {m.event.location}
                    </div>
                  )}
                  {m.event.description && <p>{m.event.description}</p>}
                  <div className="azm-event-foot">
                    <small>
                      {
                        Object.values(m.event.responses).filter(
                          (r) => r === "Going",
                        ).length
                      }{" "}
                      going
                    </small>
                    <button className="azm-text-action" onClick={onRespond}>
                      {m.event.responses[user.id] ?? "Respond"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="azm-stamp">
            {m.edited && !deleted && <span>edited</span>}
            {starred && !deleted && <span className="azm-starred" aria-label="Starred"><MIcon name="starFilled" size={16} /></span>}
            <span>{time(m.at)}</span>
            {own && !deleted && (
              <span className={`azm-receipt ${m.status ?? "sent"}`} title={m.status === "read" ? "Read" : m.status === "delivered" ? "Delivered" : m.status === "sending" ? "Sending" : m.status === "failed" ? "Failed to send" : "Sent"} aria-label={m.status ?? "sent"}>
                {m.status === "failed" ? (
                  <button aria-label="Retry message" onClick={onRetry}>
                    <MIcon name="error" />
                  </button>
                ) : m.status === "sending" ? (
                  "..."
                ) : (
                  <MIcon
                    name={
                      m.status === "read" || m.status === "delivered"
                        ? "read"
                        : "sent"
                    }
                  />
                )}
              </span>
            )}
          </div>
        </div>
        {!deleted && Object.keys(m.reactions).length > 0 && (
          <div className="azm-reactions">
            {Object.entries(m.reactions).map(([emoji, people]) => (
              <button
                key={emoji}
                onClick={onReaction}
                aria-label={`${emoji} ${people.length} reactions`}
              >
                {emoji} {people.length}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
