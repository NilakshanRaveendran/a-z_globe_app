import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MIcon, theme, type Glyph } from "./ui.web";

export type MenuItem = {
  icon: Glyph;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

/** Space kept clear of the screen edges, and between the three layers. */
const EDGE = 12;
const GAP = 8;

type Layout = {
  top: number;
  /** Distance from the message's side of the screen, for the bubble, bar and menu. */
  inset: number;
  barInset: number;
  menuInset: number;
  bubbleWidth: number;
  bubbleHeight: number;
  /** The message is taller than the room left, so it is shown cut short. */
  cut: boolean;
};

/**
 * WhatsApp-style long-press menu. The chat blurs, the pressed message stays
 * sharp where it was, the reactions float above it and the actions below —
 * lined up with the side the message sits on. When the message is near the
 * top or bottom the whole group slides to fit on screen, and a very tall
 * message is shown cut short rather than pushing the menu off.
 *
 * The message is a copy of the rendered bubble, so it looks exactly like the
 * one in the chat (photos, files, polls included) but can't be tapped.
 */
export function MessageMenu({
  messageId,
  own,
  reactions,
  current,
  items,
  onReact,
  onMoreReactions,
  onClose,
}: {
  messageId: string;
  own: boolean;
  reactions: string[];
  /** The emoji this person already reacted with, drawn highlighted. */
  current?: string;
  /** Grouped: a divider is drawn between groups. */
  items: MenuItem[][];
  onReact?: (emoji: string) => void;
  onMoreReactions?: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const el = dialog.current;
    navigator.vibrate?.(8);
    const close = () => onClose();
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("resize", close);
      el?.close();
    };
    // Opened once per press.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    // Open first: a closed <dialog> is display:none, so nothing in it has a
    // height to measure yet.
    if (!dialog.current?.open) dialog.current?.showModal();
    const source = document.querySelector<HTMLElement>(`#message-${CSS.escape(messageId)} .azm-bubble`);
    if (!source) {
      onClose();
      return;
    }
    const rect = source.getBoundingClientRect();
    const copy = source.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    copy.removeAttribute("tabindex");
    copy.setAttribute("aria-hidden", "true");
    // A picture of the message, not a working one: nothing in it can be focused.
    copy.setAttribute("inert", "");
    copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    bubble.current?.replaceChildren(copy);

    const vw = window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const barH = bar.current?.offsetHeight ?? 0;
    const menuH = menu.current?.offsetHeight ?? 0;
    const chrome = (barH ? barH + GAP : 0) + GAP + menuH;
    // A message taller than the room left is shown cut short (faded out).
    const bubbleHeight = Math.min(rect.height, Math.max(96, vh - EDGE * 2 - chrome));
    const total = chrome + bubbleHeight;
    const wanted = rect.top - (barH ? barH + GAP : 0);
    const top = Math.min(Math.max(wanted, EDGE), Math.max(EDGE, vh - EDGE - total));
    const inset = own ? Math.max(EDGE, vw - rect.right) : Math.max(EDGE, rect.left);
    // The bar and the menu start where the message does, but never run off the
    // far edge — on a narrow phone they slide back in.
    const fit = (width: number) => Math.max(EDGE, Math.min(inset, vw - EDGE - width));
    setLayout({
      top,
      inset,
      barInset: fit(bar.current?.offsetWidth ?? 0),
      menuInset: fit(menu.current?.offsetWidth ?? 0),
      bubbleWidth: Math.min(rect.width, vw - EDGE * 2),
      bubbleHeight,
      cut: rect.height > bubbleHeight + 1,
    });
    // Measured once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Everything lines up with the side the message is on.
  const at = (inset?: number) =>
    inset === undefined ? {} : own ? { marginRight: inset } : { marginLeft: inset };
  const place = at(layout?.inset);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <dialog
      ref={dialog}
      className="azm azm-popover"
      style={theme}
      aria-label="Message actions"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("azm-popover-stack"))
          onClose();
      }}
    >
      <div
        className={`azm-popover-stack ${own ? "own" : ""} ${layout ? "ready" : ""}`}
        style={{ top: layout?.top ?? 0 }}
      >
        {onReact && (
          <div ref={bar} className="azm-react-bar" style={at(layout?.barInset)} role="toolbar" aria-label="React">
            {reactions.map((emoji, i) => (
              <button
                key={emoji}
                type="button"
                className={emoji === current ? "active" : ""}
                aria-label={`React ${emoji}`}
                aria-pressed={emoji === current}
                style={{ animationDelay: `${i * 18}ms` }}
                onClick={() => onReact(emoji)}
              >
                {emoji}
              </button>
            ))}
            {onMoreReactions && (
              <button type="button" className="azm-react-more" aria-label="More reactions" onClick={onMoreReactions}>
                <MIcon name="add" size={22} />
              </button>
            )}
          </div>
        )}
        <div className={`azm-message ${own ? "own" : ""} azm-popover-message`} style={place}>
          <div
            ref={bubble}
            className={`azm-popover-bubble ${layout?.cut ? "cut" : ""}`}
            style={layout ? { width: layout.bubbleWidth, maxHeight: layout.bubbleHeight } : undefined}
          />
        </div>
        <div ref={menu} className="azm-popover-menu" style={at(layout?.menuInset)} role="menu">
          {items
            .filter((group) => group.length)
            .map((group, g) => (
              <div key={g} className="azm-popover-group">
                {group.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className={item.danger ? "danger" : ""}
                    onClick={run(item.onPress)}
                  >
                    <MIcon name={item.icon} size={21} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
        </div>
      </div>
    </dialog>
  );
}
