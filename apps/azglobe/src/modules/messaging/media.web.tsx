import { useEffect, useRef, useState } from "react";
import { deleteFiles, readFile, saveFile } from "./store.web";
import type { Attachment, Message } from "./model";
import { fileBadge, fileKind, formatBytes, isVisual, mimeFor } from "./model";
import { artwork, Field, IconButton, MIcon, Primary, Sheet } from "./ui.web";

export function useFileUrl(file?: Attachment) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setUrl("");
    if (!file) return;
    if (file.url === "food" || file.url === "hotel") {
      setUrl(artwork[file.url]);
      return;
    }
    const get =
      file.url === "sample-voice"
        ? fetch(artwork.voice)
            .then((r) => {
              if (!r.ok) throw new Error("Sample audio unavailable");
              return r.arrayBuffer();
            })
            .then((buffer) => new Blob([buffer], { type: "audio/mp4" }))
        : file.url === "sample-document"
          ? Promise.resolve(
              new Blob(
                [
                  "A-Z Globe supplier shortlist\nRoyal Decorations - outdoor events\nYaal Angaadi - catering\nConfirm availability directly with each provider.",
                ],
                { type: "text/plain" },
              ),
            )
          : readFile(file.id);
    void get
      .then((blob) => {
        if (active && blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file?.id, file?.url]);
  return url;
}
export function MediaThumb({
  file,
  onOpen,
}: {
  file: Attachment;
  onOpen: () => void;
}) {
  const url = useFileUrl(file);
  return (
    <button
      type="button"
      className="azm-media-button"
      aria-label={`Open ${file.name}`}
      onClick={onOpen}
    >
      {url ? (
        file.mime.startsWith("video/") ? (
          <video src={url} muted playsInline preload="metadata" />
        ) : (
          <img src={url} alt={file.name} />
        )
      ) : (
        <span className="azm-padding">
          <MIcon name="image" /> Media unavailable
        </span>
      )}
      {file.mime.startsWith("video/") && (
        <span
          style={{
            position: "absolute",
            inset: "40% auto auto 40%",
            color: "white",
          }}
        >
          <MIcon name="play" size={32} />
        </span>
      )}
    </button>
  );
}
/**
 * Any non-visual file: a coloured badge with its type ("PDF", "DOCX", "MP3"),
 * the name and size. The card opens the viewer; the arrow downloads it.
 */
export function FileMessage({
  file,
  onOpen,
}: {
  file: Attachment;
  onOpen?: () => void;
}) {
  const url = useFileUrl(file);
  const kind = fileKind(file);
  return (
    <div className="azm-file" data-kind={kind}>
      <button
        type="button"
        className="azm-file-main"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={`Open ${file.name}`}
      >
        <span className="azm-file-badge" aria-hidden>
          {fileBadge(file)}
        </span>
        <span className="azm-file-text">
          <strong dir="auto">{file.name}</strong>
          <small>
            {formatBytes(file.size)}
            {url ? "" : " · unavailable"}
          </small>
        </span>
      </button>
      <a
        className="azm-file-download"
        href={url || undefined}
        download={file.name}
        aria-label={`Download ${file.name}`}
        aria-disabled={!url}
        onClick={(e) => {
          if (!url) e.preventDefault();
        }}
      >
        <MIcon name="download" size={20} />
      </a>
    </div>
  );
}
/** A shared audio file — its name over the same player voice notes use. */
export function AudioMessage({ file }: { file: Attachment }) {
  return (
    <div className="azm-audio">
      <div className="azm-audio-title">
        <span className="azm-file-badge" data-kind="audio" aria-hidden>
          <MIcon name="audio" size={16} />
        </span>
        <span>
          <strong dir="auto">{file.name}</strong>
          <small>{formatBytes(file.size)}</small>
        </span>
      </div>
      <VoiceMessage file={file} />
    </div>
  );
}
/** 28 bar heights (0.25–1), stable per file so a note keeps its shape. */
function waveform(seed: string): number[] {
  let h = 0;
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 28 }, (_, i) => {
    h = (h * 1103515245 + 12345 + i) >>> 0;
    return 0.25 + ((h >>> 16) % 1000) / 1333;
  });
}
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
/**
 * Voice note player — a round play button, a waveform that fills as it plays
 * and the remaining time, in place of the browser's own audio controls.
 */
export function VoiceMessage({ file }: { file: Attachment }) {
  const url = useFileUrl(file);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(file.duration ?? 0);
  const bars = waveform(file.id);
  if (!url) return <p>Audio unavailable on this device.</p>;
  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };
  const lit = Math.round(progress * bars.length);
  return (
    <div className="azm-voice">
      <button
        type="button"
        className="azm-voice-play"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        onClick={toggle}
      >
        <MIcon name={playing ? "pause" : "play"} size={22} />
      </button>
      <span className="azm-voice-bars" aria-hidden>
        {bars.map((height, i) => (
          <i key={i} className={i < lit ? "on" : ""} style={{ height: `${Math.round(height * 100)}%` }} />
        ))}
      </span>
      <small>{clock(playing || progress ? duration * (1 - progress) : duration)}</small>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          // Recorded WebM reports an Infinity duration until it has played
          // through once; fall back to the length we already know.
          const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration;
          if (d > 0) setProgress(Math.min(1, el.currentTime / d));
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        hidden
      />
    </div>
  );
}
/** Text files read as UTF-8, or UTF-16 when they start with its byte-order mark. */
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setText(null);
    void fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        const bytes = new Uint8Array(buffer.slice(0, 2));
        const encoding =
          bytes[0] === 0xff && bytes[1] === 0xfe
            ? "utf-16le"
            : bytes[0] === 0xfe && bytes[1] === 0xff
              ? "utf-16be"
              : "utf-8";
        const limit = 512 * 1024;
        // `stream` holds back a character cut in half at the limit instead of
        // printing it as �.
        const decoded = new TextDecoder(encoding).decode(buffer.slice(0, limit), { stream: true });
        if (alive) setText(buffer.byteLength > limit ? `${decoded}\n…` : decoded);
      })
      .catch(() => alive && setText(""));
    return () => {
      alive = false;
    };
  }, [url]);
  if (text === null) return <p className="azm-viewer-note">Loading…</p>;
  return (
    <pre className="azm-text-preview" dir="auto">
      {text || "This file is empty."}
    </pre>
  );
}
/**
 * Opens any shared file: photos and videos full size, audio in the player,
 * PDFs in the browser's own viewer, text as text, and everything else as a
 * card with Open and Download. Swipe or use the arrows to move between files.
 */
export function MediaViewer({
  files,
  initial = 0,
  onClose,
}: {
  files: Attachment[];
  initial?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initial);
  const file = files[index]!;
  const url = useFileUrl(file);
  const kind = fileKind(file);
  const x = useRef(0);
  const body = !url ? (
    <p className="azm-viewer-note">This file isn’t available on this device.</p>
  ) : kind === "image" ? (
    <img className="azm-preview-media" src={url} alt={file.name} />
  ) : kind === "video" ? (
    <video className="azm-preview-media" src={url} controls playsInline />
  ) : kind === "audio" ? (
    <div className="azm-viewer-audio">
      <span className="azm-file-badge large" data-kind="audio" aria-hidden>
        <MIcon name="audio" size={36} />
      </span>
      {/* Keyed so moving to the next file starts a fresh player. */}
      <VoiceMessage key={file.id} file={file} />
    </div>
  ) : kind === "pdf" && navigator.pdfViewerEnabled !== false ? (
    <iframe className="azm-pdf" src={url} title={file.name} />
  ) : kind === "text" || mimeFor(file.name, file.mime).startsWith("text/") ? (
    <TextPreview url={url} />
  ) : (
    <div className="azm-viewer-card" data-kind={kind}>
      <span className="azm-file-badge large" aria-hidden>
        {fileBadge(file)}
      </span>
      <strong dir="auto">{file.name}</strong>
      <small>{formatBytes(file.size)}</small>
      <p>This file can’t be previewed here. Open it or download it to view it.</p>
    </div>
  );
  return (
    <Sheet title={file.name} onClose={onClose}>
      <div
        onTouchStart={(e) => {
          x.current = e.touches[0]?.clientX ?? 0;
        }}
        onTouchEnd={(e) => {
          const dx = (e.changedTouches[0]?.clientX ?? x.current) - x.current;
          if (Math.abs(dx) > 50 && kind !== "pdf")
            setIndex((i) =>
              Math.min(files.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1))),
            );
        }}
      >
        {body}
        {files.length > 1 && (
          <div className="azm-viewer-nav">
            <IconButton
              name="prev"
              label="Previous file"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            />
            <span>
              {index + 1} of {files.length}
            </span>
            <IconButton
              name="next"
              label="Next file"
              disabled={index === files.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            />
          </div>
        )}
        {url && (
          <div className="azm-viewer-actions">
            <a className="azm-primary secondary" href={url} target="_blank" rel="noreferrer">
              <MIcon name="open" size={20} />
              Open
            </a>
            <a className="azm-primary" href={url} download={file.name}>
              <MIcon name="download" size={20} />
              Download
            </a>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Per-file limit. Files live in this browser's IndexedDB until sent to a server. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10;

export type ShareKind = "media" | "camera" | "document" | "audio";

export function MediaShare({
  kind,
  initial,
  onClose,
  onSend,
}: {
  kind: ShareKind;
  /** Files pasted or dropped into the chat. */
  initial?: File[];
  onClose: () => void;
  onSend: (message: Partial<Message>) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const visual = kind === "media" || kind === "camera";
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  const select = (selected: File[]) => {
    if (!selected.length) return;
    const tooBig = selected.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`“${tooBig.name}” is ${formatBytes(tooBig.size)}. Choose files up to ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    if (selected.some((f) => f.size === 0)) {
      setError("One of those files is empty.");
      return;
    }
    const wrong = selected.find((f) => {
      const k = fileKind({ name: f.name, mime: f.type });
      return visual ? !isVisual({ name: f.name, mime: f.type }) : kind === "audio" ? k !== "audio" : false;
    });
    if (wrong) {
      setError(
        visual
          ? `“${wrong.name}” isn’t a photo or video. Use Files to send it.`
          : `“${wrong.name}” isn’t an audio file. Use Files to send it.`,
      );
      return;
    }
    setError(selected.length + files.length > MAX_FILES ? `Up to ${MAX_FILES} files at a time — the first ${MAX_FILES} were kept.` : "");
    setFiles((previous) => [...previous, ...selected].slice(0, MAX_FILES));
  };
  useEffect(() => {
    if (initial?.length) select(initial);
    // Only the files handed over when the sheet opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const send = async () => {
    setBusy(true);
    setError("");
    const attachments: Attachment[] = [];
    try {
      for (const file of files) {
        const id = crypto.randomUUID();
        await saveFile(id, file);
        attachments.push({
          id,
          name: file.name || "file",
          mime: mimeFor(file.name, file.type),
          size: file.size,
        });
      }
      onSend({
        kind: attachments.every(isVisual) ? "media" : "document",
        text: caption.trim(),
        attachments,
      });
    } catch (e) {
      // Don't leave the files that did save behind with no message to show them.
      void deleteFiles(attachments.map((a) => a.id)).catch(() => undefined);
      setError(
        e instanceof Error && /quota/i.test(e.message)
          ? "This device is out of storage for attachments. Delete some shared files (Delete for everyone) and try again."
          : e instanceof Error
            ? e.message
            : "Could not save the file.",
      );
    } finally {
      setBusy(false);
    }
  };
  const title = { media: "Photos & Videos", camera: "Camera", document: "Files", audio: "Audio" }[kind];
  const chooseLabel = {
    media: "Choose photos & videos",
    camera: "Take a photo",
    document: "Choose files",
    audio: "Choose audio",
  }[kind];
  const current = files[index];
  return (
    <Sheet title={title} onClose={onClose}>
      {error && (
        <p role="alert" className="azm-error">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        hidden
        style={{ display: "none" }}
        aria-label={chooseLabel}
        accept={
          kind === "document"
            ? undefined
            : kind === "camera"
              ? "image/*"
              : kind === "audio"
                ? "audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.amr"
                : "image/*,video/*"
        }
        capture={kind === "camera" ? "environment" : undefined}
        multiple={kind !== "camera"}
        onChange={(e) => {
          select(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {!files.length ? (
        kind === "camera" ? (
          <Camera
            onCapture={(file) => select([file])}
            onFallback={() => input.current?.click()}
          />
        ) : (
          <div className="azm-empty azm-picker">
            <span className="azm-empty-icon">
              <MIcon
                name={kind === "document" ? "attach" : kind === "audio" ? "audio" : "image"}
                size={40}
              />
            </span>
            <p>
              {kind === "document"
                ? "PDFs, Word, Excel, PowerPoint, text, ZIP — any file up to 50 MB."
                : kind === "audio"
                  ? "MP3, M4A, WAV, OGG and other audio up to 50 MB."
                  : "Photos and videos up to 50 MB each."}
            </p>
            <Primary onClick={() => input.current?.click()}>{chooseLabel}</Primary>
          </div>
        )
      ) : (
        <>
          {visual ? (
            <>
              {current && fileKind({ name: current.name, mime: current.type }) === "video" ? (
                <video className="azm-preview-media" src={urls[index]} controls playsInline />
              ) : (
                <img className="azm-preview-media" src={urls[index]} alt="Selected attachment" />
              )}
              <div className="azm-media-thumbs">
                {files.map((f, i) => (
                  <button
                    key={`${f.name}-${i}`}
                    className={index === i ? "active" : ""}
                    onClick={() => setIndex(i)}
                    aria-label={`Preview attachment ${i + 1}`}
                  >
                    {fileKind({ name: f.name, mime: f.type }) === "image" && urls[i] ? (
                      <img src={urls[i]} alt="" />
                    ) : (
                      <MIcon name="play" size={20} />
                    )}
                  </button>
                ))}
                {files.length < MAX_FILES && (
                  <IconButton name="add" label="Add more" onClick={() => input.current?.click()} />
                )}
                <IconButton
                  name="delete"
                  label="Remove selected attachment"
                  onClick={() => {
                    setFiles((prev) => prev.filter((_, i) => i !== index));
                    setIndex(0);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="azm-file-list">
              {files.map((f, i) => {
                const meta = { name: f.name, mime: f.type };
                return (
                  <div key={`${f.name}-${i}`} className="azm-file" data-kind={fileKind(meta)}>
                    <span className="azm-file-main">
                      <span className="azm-file-badge" aria-hidden>
                        {fileBadge(meta)}
                      </span>
                      <span className="azm-file-text">
                        <strong dir="auto">{f.name}</strong>
                        <small>{formatBytes(f.size)}</small>
                      </span>
                    </span>
                    <IconButton
                      name="close"
                      label={`Remove ${f.name}`}
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    />
                  </div>
                );
              })}
              {files.length < MAX_FILES && (
                <button type="button" className="azm-text-action" onClick={() => input.current?.click()}>
                  + Add more
                </button>
              )}
            </div>
          )}
          <Field label="Caption">
            <textarea
              dir="auto"
              placeholder="Add a caption..."
              value={caption}
              maxLength={2000}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>
          <Primary disabled={busy} onClick={() => void send()}>
            <MIcon name="send" />
            {busy ? "Saving..." : files.length > 1 ? `Send ${files.length} files` : "Send"}
          </Primary>
        </>
      )}
    </Sheet>
  );
}
function Camera({
  onCapture,
  onFallback,
}: {
  onCapture: (file: File) => void;
  onFallback: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    let stream: MediaStream | undefined;
    setReady(false);
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera requires HTTPS and browser permission.");
      return;
    }
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {
            if (alive) setError("Tap the preview to start the camera.");
          });
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "Camera access was not granted. You can choose a photo instead.",
          );
      });
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);
  const capture = () => {
    const element = video.current;
    if (!element?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob)
          onCapture(
            new File([blob], `Camera-${Date.now()}.jpg`, {
              type: "image/jpeg",
            }),
          );
      },
      "image/jpeg",
      0.9,
    );
  };
  return (
    <>
      <video
        ref={video}
        muted
        playsInline
        className="azm-preview-media"
        aria-label="Camera preview"
        onLoadedData={() => setReady(true)}
        onClick={() => void video.current?.play().catch(() => setError("Camera preview unavailable."))}
      />
      {error && (
        <p role="alert" className="azm-error">
          {error}
        </p>
      )}
      <div className="azm-form-row">
        <Primary disabled={!ready} onClick={capture}>
          <MIcon name="camera" />
          Capture
        </Primary>
        <button
          className="azm-text-action"
          onClick={() =>
            setFacing((f) => (f === "user" ? "environment" : "user"))
          }
        >
          Switch camera
        </button>
      </div>
      <button className="azm-text-action" onClick={onFallback}>
        Choose a photo
      </button>
    </>
  );
}

export function VoiceRecorder({
  pointer,
  onCancel,
  onSend,
}: {
  pointer: { x: number; y: number } | null;
  onCancel: () => void;
  onSend: (message: Partial<Message>) => void;
}) {
  const [status, setStatus] = useState<
    "asking" | "recording" | "paused" | "preview" | "saving"
  >("asking");
  const [locked, setLocked] = useState(!pointer);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob>();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const lockedRef = useRef(!pointer);
  const released = useRef(false);
  const stopMode = useRef<"send" | "preview" | "cancel">("preview");
  const duration = useRef(0);
  const callbacks = useRef({ onCancel, onSend });
  callbacks.current = { onCancel, onSend };
  const mounted = useRef(true);
  const save = async (audio: Blob) => {
    setStatus("saving");
    try {
      const id = crypto.randomUUID();
      await saveFile(id, audio);
      if (mounted.current)
        callbacks.current.onSend({
          kind: "voice",
          attachments: [
            {
              id,
              name: "Voice message",
              mime: audio.type,
              size: audio.size,
              duration: duration.current,
            },
          ],
        });
    } catch {
      if (mounted.current) {
        setError("Could not save recording. Try again or cancel.");
        setStatus("preview");
      }
    }
  };
  const stop = (mode: typeof stopMode.current) => {
    stopMode.current = mode;
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
    else if (mode === "cancel") callbacks.current.onCancel();
  };
  useEffect(() => {
    let alive = true;
    mounted.current = true;
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const release = () => {
      released.current = true;
      if (!lockedRef.current && recorder.current) stop("send");
    };
    const cancelPointer = () => {
      if (!lockedRef.current) {
        released.current = true;
        stop("cancel");
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointer || lockedRef.current) return;
      if (e.clientX < pointer.x - 80) {
        released.current = true;
        stop("cancel");
      } else if (e.clientY < pointer.y - 60) {
        lockedRef.current = true;
        setLocked(true);
      }
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("pointermove", move);
    const start = async () => {
      try {
        if (
          !window.isSecureContext ||
          !navigator.mediaDevices?.getUserMedia ||
          !window.MediaRecorder
        )
          throw new Error(
            "Voice recording requires HTTPS and microphone support.",
          );
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!alive || (released.current && !lockedRef.current)) {
          stream.getTracks().forEach((t) => t.stop());
          if (alive) callbacks.current.onCancel();
          return;
        }
        const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((type) =>
          MediaRecorder.isTypeSupported(type),
        );
        const r = new MediaRecorder(
          stream,
          mime ? { mimeType: mime } : undefined,
        );
        recorder.current = r;
        const chunks: Blob[] = [];
        r.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        r.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop());
          if (!alive) return;
          const result = new Blob(chunks, { type: r.mimeType });
          if (stopMode.current === "cancel" || !result.size) {
            callbacks.current.onCancel();
            return;
          }
          setBlob(result);
          setStatus("preview");
          if (stopMode.current === "send") void save(result);
        };
        r.start(250);
        setStatus("recording");
        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const levels = new Uint8Array(analyser.frequencyBinCount);
        timer = setInterval(() => {
          if (r.state === "recording") {
            duration.current += 0.1;
            setSeconds(duration.current);
            analyser.getByteFrequencyData(levels);
            setLevel(levels.reduce((a, b) => a + b, 0) / levels.length / 255);
            if (duration.current >= 180) stop("preview");
          }
        }, 100);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error
              ? e.message
              : "Microphone access was not granted.",
          );
        stream?.getTracks().forEach((t) => t.stop());
      }
    };
    void start();
    return () => {
      alive = false;
      mounted.current = false;
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      void audioContext?.close();
      clearInterval(timer);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancelPointer);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return (
    <div className="azm-recording" aria-label="Voice recording">
      {error && (
        <p role="alert" className="azm-error">
          {error}
        </p>
      )}
      <div className="azm-record-row">
        <IconButton
          name="delete"
          label="Cancel recording"
          onClick={() => stop("cancel")}
        />
        <span className="azm-record-dot" />
        <span>
          {Math.floor(seconds / 60)}:
          {String(Math.floor(seconds % 60)).padStart(2, "0")}
        </span>
        <div className="azm-wave" aria-label="Microphone level">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} style={{ height: 4 + level * (10 + (i % 7) * 5) }} />
          ))}
        </div>
        {status === "asking" ? (
          <small>{error ? "Unavailable" : "Allow microphone..."}</small>
        ) : status === "preview" ? (
          <IconButton
            name="send"
            label="Send voice message"
            className="azm-send"
            onClick={() => blob && void save(blob)}
          />
        ) : status === "saving" ? (
          <small>Saving...</small>
        ) : locked ? (
          <>
            <IconButton
              name={status === "paused" ? "play" : "pause"}
              label={
                status === "paused" ? "Resume recording" : "Pause recording"
              }
              onClick={() => {
                if (status === "paused") {
                  recorder.current?.resume();
                  setStatus("recording");
                } else {
                  recorder.current?.pause();
                  setStatus("paused");
                }
              }}
            />
            <IconButton
              name="sent"
              label="Preview recording"
              onClick={() => stop("preview")}
            />
          </>
        ) : (
          <IconButton
            name="lock"
            label="Lock recording"
            onClick={() => {
              lockedRef.current = true;
              setLocked(true);
            }}
          />
        )}
      </div>
      {url && <audio controls src={url} aria-label="Recording preview" />}
      {status === "recording" && !locked && (
        <small>Slide left to cancel · Slide up to lock</small>
      )}
    </div>
  );
}
