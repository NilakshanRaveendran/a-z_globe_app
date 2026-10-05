import {
  useEffect,
  useRef,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
  type CSSProperties,
  type ButtonHTMLAttributes,
} from "react";
import { Asset } from "expo-asset";
import { colors, fontFamily } from "@core/theme";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import MicRounded from "@mui/icons-material/MicRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import CameraAltRounded from "@mui/icons-material/CameraAltRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import LocationOnRounded from "@mui/icons-material/LocationOnRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import PollRounded from "@mui/icons-material/PollRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import EmojiEmotionsOutlined from "@mui/icons-material/EmojiEmotionsOutlined";
import ReplyRounded from "@mui/icons-material/ReplyRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import NotificationsOffRounded from "@mui/icons-material/NotificationsOffRounded";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import DoneRounded from "@mui/icons-material/DoneRounded";
import DoneAllRounded from "@mui/icons-material/DoneAllRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import DeleteForeverOutlined from "@mui/icons-material/DeleteForeverOutlined";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import ForwardRounded from "@mui/icons-material/ForwardRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import StarOutlineRounded from "@mui/icons-material/StarOutlineRounded";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import EditRounded from "@mui/icons-material/EditRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import ReportProblemOutlined from "@mui/icons-material/ReportProblemOutlined";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import AudiotrackRounded from "@mui/icons-material/AudiotrackRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import AttachFileRounded from "@mui/icons-material/AttachFileRounded";
import { initials } from "@core/utils/text";
import "./messaging.css";
import { statusBarBlurGap } from "./pwaInsets";

const icons = {
  back: ArrowBackRounded,
  search: SearchRounded,
  more: MoreVertRounded,
  add: AddRounded,
  groups: GroupsRounded,
  chat: ChatBubbleOutlineRounded,
  mic: MicRounded,
  send: SendRounded,
  camera: CameraAltRounded,
  image: ImageRounded,
  location: LocationOnRounded,
  document: DescriptionRounded,
  poll: PollRounded,
  event: EventRounded,
  emoji: EmojiEmotionsOutlined,
  reply: ReplyRounded,
  close: CloseRounded,
  muted: NotificationsOffRounded,
  bell: NotificationsNoneRounded,
  person: PersonRounded,
  next: ChevronRightRounded,
  prev: ChevronLeftRounded,
  down: KeyboardArrowDownRounded,
  up: KeyboardArrowUpRounded,
  sent: DoneRounded,
  read: DoneAllRounded,
  lock: LockRounded,
  delete: DeleteForeverOutlined,
  unavailable: BlockOutlined,
  play: PlayArrowRounded,
  pause: PauseRounded,
  error: ErrorOutlineRounded,
  copy: ContentCopyRounded,
  forward: ForwardRounded,
  star: StarOutlineRounded,
  starFilled: StarRounded,
  info: InfoOutlined,
  edit: EditRounded,
  leave: LogoutRounded,
  report: ReportProblemOutlined,
  download: DownloadRounded,
  link: LinkRounded,
  settings: SettingsRounded,
  success: CheckCircleRounded,
  audio: AudiotrackRounded,
  open: OpenInNewRounded,
  file: InsertDriveFileRounded,
  pdf: PictureAsPdfRounded,
  attach: AttachFileRounded,
};
export type Glyph = keyof typeof icons;
export function MIcon({ name, size = 22 }: { name: Glyph; size?: number }) {
  const Component = icons[name];
  return <Component aria-hidden style={{ fontSize: size, flexShrink: 0 }} />;
}
export function IconButton({
  name,
  label,
  className = "",
  ...props
}: { name: Glyph; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`azm-icon ${name === "back" ? "azm-back" : ""} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <MIcon name={name} />
    </button>
  );
}
export function Primary({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`azm-primary ${className}`} {...props}>
      {children}
    </button>
  );
}
export const artwork = {
  food: Asset.fromModule(require("../../../assets/images/food/kottu.jpg")).uri,
  hotel: Asset.fromModule(
    require("../../../assets/images/food/merchant-trinco-blu.jpg"),
  ).uri,
  voice: Asset.fromModule(require("../../../assets/group-voice-sample.m4a"))
    .uri,
};
/**
 * Soft background + ink pairs for initials avatars and sender names — the same
 * family the customer review cards use, so a person keeps one colour
 * everywhere in a chat.
 */
const TONES = [
  [colors.primaryTint, colors.primary],
  ["#EDE9FE", "#7C3AED"],
  ["#DCFCE7", "#16A34A"],
  ["#FFEDD5", "#EA580C"],
  ["#DBEAFE", "#2563EB"],
  ["#FCE7F3", "#DB2777"],
] as const;
export function toneFor(name: string): { background: string; color: string } {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [background, color] = TONES[hash % TONES.length]!;
  return { background, color };
}
export function Avatar({
  name,
  image,
  large = false,
}: {
  name: string;
  image?: string;
  large?: boolean;
}) {
  const src =
    image &&
    (image in artwork
      ? artwork[image as keyof typeof artwork]
      : image.startsWith("data:image/")
        ? image
        : undefined);
  return (
    <span
      className={`azm-avatar ${large ? "large" : ""}`}
      style={src ? undefined : toneFor(name)}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
export function Header({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="azm-header">
      {onBack && <IconButton name="back" label="Go back" onClick={onBack} />}
      <h1>{title}</h1>
      {children}
    </header>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="azm-empty">
      <span className="azm-empty-icon">
        <MIcon name="groups" size={36} />
      </span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Where the press began: a drag that starts inside the panel (selecting
  // text) and ends on the backdrop is not a tap outside.
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="azm azm-sheet"
      style={theme}
      onCancel={onClose}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
        downOnBackdrop.current = false;
      }}
      aria-label={title}
    >
      <div className="azm-sheet-inner">
        <div className="azm-handle" />
        <Header title={title}>
          <IconButton name="close" label="Close" onClick={onClose} />
        </Header>
        <div className="azm-sheet-content">{children}</div>
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="azm-field" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      {isValidElement<{ id?: string; "aria-labelledby"?: string }>(children)
        ? cloneElement(children, { id, "aria-labelledby": `${id}-label` })
        : children}
    </label>
  );
}
export const theme = {
  "--az-red": colors.primary,
  "--az-tint": colors.primaryTint,
  "--az-text": colors.text,
  "--az-muted": colors.textSecondary,
  "--az-soft": colors.surfaceAlt,
  "--az-line": colors.border,
  "--az-page": colors.surfaceSunken,
  "--az-faint": colors.textMuted,
  "--az-strong": colors.textStrong,
  "--az-green": colors.palette.green600,
  "--az-font": fontFamily[500],
  "--az-bold": fontFamily[700],
  "--az-regular": fontFamily[400],
} as CSSProperties;
export function Frame({ children }: { children: ReactNode }) {
  const topClearance = typeof navigator === "undefined" ? 0 : statusBarBlurGap(navigator);
  return (
    <section className="azm azm-frame" style={{ ...theme, "--az-status-bar-clearance": `${topClearance}px` } as CSSProperties}>
      {children}
    </section>
  );
}
export function time(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
export function dateLabel(at: number) {
  const d = new Date(at);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  today.setDate(today.getDate() - 1);
  return d.toDateString() === today.toDateString()
    ? "Yesterday"
    : d.toLocaleDateString([], {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}
