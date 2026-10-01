import { useState } from "react";
import { categories, type Group, type Message } from "./model";
import { Avatar, Field, IconButton, MIcon, Primary, Sheet } from "./ui.web";

/**
 * On/off row with the app's switch (Restaurant Info's 44×24 red pill), so
 * Messages settings look like every other settings screen.
 */
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="azm-toggle">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`azm-switch ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  );
}
export function PollForm({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (m: Partial<Message>) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [error, setError] = useState("");
  const submit = () => {
    const trimmed = options.map((o) => o.trim()).filter(Boolean);
    if (
      !question.trim() ||
      trimmed.length < 2 ||
      new Set(trimmed.map((o) => o.toLowerCase())).size !== trimmed.length
    ) {
      setError("Add a question and at least two different options.");
      return;
    }
    onSend({
      kind: "poll",
      text: question.trim(),
      poll: { options: trimmed, multiple, votes: {} },
    });
  };
  return (
    <Sheet title="Create Poll" onClose={onClose}>
      {error && (
        <p role="alert" className="azm-error">
          {error}
        </p>
      )}
      <Field label="Question">
        <input
          placeholder="Ask a question..."
          maxLength={200}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </Field>
      <h3>Options</h3>
      {options.map((o, i) => (
        <div className="azm-form-row" key={i}>
          <Field label={`Option ${i + 1}`}>
            <input
              placeholder={`Option ${i + 1}`}
              maxLength={100}
              value={o}
              onChange={(e) =>
                setOptions((prev) =>
                  prev.map((v, n) => (n === i ? e.target.value : v)),
                )
              }
            />
          </Field>
          {options.length > 2 && (
            <IconButton
              name="close"
              label={`Remove option ${i + 1}`}
              onClick={() =>
                setOptions((prev) => prev.filter((_, n) => n !== i))
              }
            />
          )}
        </div>
      ))}
      {options.length < 10 && (
        <button
          className="azm-text-action"
          onClick={() => setOptions((prev) => [...prev, ""])}
        >
          + Add option
        </button>
      )}
      <Toggle
        label="Allow multiple answers"
        value={multiple}
        onChange={setMultiple}
      />
      <Primary onClick={submit}>Create Poll</Primary>
    </Sheet>
  );
}
export function EventForm({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (m: Partial<Message>) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const from = new Date(`${date}T${start}`);
    const to = new Date(`${date}T${end}`);
    if (
      !title.trim() ||
      !location.trim() ||
      !Number.isFinite(+from) ||
      +from <= Date.now() ||
      +to <= +from
    ) {
      setError(
        "Add a title and location, a future date, and an end time after the start.",
      );
      return;
    }
    onSend({
      kind: "event",
      event: {
        title: title.trim(),
        start: from.toISOString(),
        end: to.toISOString(),
        location: location.trim(),
        description,
        responses: {},
      },
    });
  };
  return (
    <Sheet title="Create Event" onClose={onClose}>
      {error && (
        <p className="azm-error" role="alert">
          {error}
        </p>
      )}
      <Field label="Event Title">
        <input
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Community Meetup"
        />
      </Field>
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <div className="azm-form-row">
        <Field label="Start Time">
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="End Time">
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Location">
        <input
          value={location}
          maxLength={200}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="GR Plaza, Trincomalee"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Primary onClick={submit}>Create Event</Primary>
    </Sheet>
  );
}
export function LocationForm({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (m: Partial<Message>) => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Message["location"]>();
  const places = [
    { name: "Dutch Bay, Trincomalee", lat: 8.5715, lng: 81.2385 },
    { name: "Trincomalee Railway Station", lat: 8.5878, lng: 81.2243 },
    { name: "Uppuveli Beach, Trincomalee", lat: 8.6097, lng: 81.2185 },
  ];
  const current = () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setError("Current location requires HTTPS and location permission.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setSelected({
          name: "Current Location",
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        });
        setBusy(false);
      },
      () => {
        setBusy(false);
        setError(
          "Location could not be obtained. Allow access or select a place.",
        );
      },
      { timeout: 15000, maximumAge: 60000 },
    );
  };
  return (
    <Sheet title="Share Location" onClose={onClose}>
      {error && (
        <p role="alert" className="azm-error">
          {error}
        </p>
      )}
      {selected && (
        <div className="azm-info-section">
          <a
            className="azm-location"
            href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=16/${selected.lat}/${selected.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <MIcon name="location" size={40} />
            <h3>{selected.name}</h3>
            <small>
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} · Open map
            </small>
          </a>
        </div>
      )}
      <Field label="Search a place">
        <input
          placeholder="Search nearby places"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>
      <button className="azm-action" disabled={busy} onClick={current}>
        <MIcon name="location" />
        <span>{busy ? "Locating..." : "Your Current Location"}</span>
      </button>
      <h3>Nearby Places</h3>
      {places
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .map((p) => (
          <button
            key={p.name}
            className="azm-action"
            onClick={() => setSelected(p)}
          >
            <MIcon name="location" />
            <span>{p.name}</span>
            {selected?.name === p.name && <MIcon name="sent" />}
          </button>
        ))}
      <Primary
        disabled={!selected}
        onClick={() =>
          selected && onSend({ kind: "location", location: selected })
        }
      >
        Send{" "}
        {selected?.name === "Current Location"
          ? "Current Location"
          : "Location"}
      </Primary>
    </Sheet>
  );
}

type GroupInput = Pick<
  Group,
  "name" | "description" | "category" | "image" | "permissions"
>;
export function GroupForm({
  group,
  canConfigure = true,
  onClose,
  onSave,
}: {
  group?: Group;
  canConfigure?: boolean;
  onClose: () => void;
  onSave: (input: GroupInput) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [category, setCategory] = useState(group?.category ?? "");
  const [image, setImage] = useState(group?.image ?? "");
  const [permissions, setPermissions] = useState<Group["permissions"]>(
    group?.permissions ?? {
      posting: "everyone",
      editing: "admins",
      joining: "anyone",
      polls: true,
      events: true,
    },
  );
  const [error, setError] = useState("");
  const save = () => {
    try {
      onSave({ name, description, category, image, permissions });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save group.");
    }
  };
  const total = canConfigure ? 2 : 1;
  // Group photos are kept with the groups in browser storage (a few MB in
  // all), so each is shrunk to a 256px JPEG — a few KB — before it is saved.
  const pickPhoto = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Choose a photo (JPG, PNG or WebP).");
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const scale = Math.max(size / img.width, size / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const w = img.width * scale;
      const h = img.height * scale;
      canvas.getContext("2d")?.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      setImage(canvas.toDataURL("image/jpeg", 0.82));
      setError("");
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError("That photo could not be opened. Try another.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  return (
    <Sheet
      title={
        step === 2 ? "Group Settings" : group ? "Edit Group" : "Create Group"
      }
      onClose={onClose}
    >
      {total > 1 && (
        <div className="azm-steps" aria-label={`Step ${step} of ${total}`}>
          <span className="active" />
          <span className={step === 2 ? "active" : ""} />
          <small>
            Step {step} of {total} · {step === 1 ? "Details" : "Settings"}
          </small>
        </div>
      )}
      {error && (
        <p role="alert" className="azm-error">
          {error}
        </p>
      )}
      {step === 1 ? (
        <>
          {/* The same photo row as Add / Edit Item: preview, name, hint, one button. */}
          <div className="azm-field">
            <span>Group Photo</span>
            <div className="azm-photo-row">
              <Avatar name={name || "A-Z Group"} image={image} />
              <div className="azm-photo-info">
                <strong>{image ? "Photo added" : "No photo yet"}</strong>
                <small>Optional · JPG, PNG or WebP</small>
                <div className="azm-photo-actions">
                  <label className="azm-pill-button">
                    <MIcon name={image ? "edit" : "add"} size={14} />
                    {image ? "Change photo" : "Add photo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      style={{ display: "none" }}
                      onChange={(e) => {
                        pickPhoto(e.target.files?.[0]);
                        // So choosing the same file again still fires.
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {image && (
                    <button type="button" className="azm-pill-link" onClick={() => setImage("")}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Field label="Group Name *">
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trincomalee Event Professionals"
            />
          </Field>
          <Field label="Description *">
            <textarea
              value={description}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What brings your group together?"
            />
          </Field>
          <Choice
            label="Category *"
            value={category}
            options={categories.slice(1).map((c) => [c, c] as [string, string])}
            onChange={setCategory}
          />
          <Primary
            onClick={() => {
              if (!name.trim() || !description.trim() || !category) {
                setError("Add a name, a description and a category to continue.");
                return;
              }
              setError("");
              if (canConfigure) setStep(2);
              else save();
            }}
          >
            {canConfigure ? "Continue" : "Save Changes"}
          </Primary>
        </>
      ) : (
        <>
          <Choice
            label="Who can send messages?"
            value={permissions.posting}
            options={[
              ["everyone", "Everyone"],
              ["admins", "Admins only"],
            ]}
            onChange={(posting) => setPermissions((p) => ({ ...p, posting }))}
          />
          <Choice
            label="Who can edit group info?"
            value={permissions.editing}
            options={[
              ["admins", "Provider & admins"],
              ["everyone", "Everyone"],
            ]}
            onChange={(editing) => setPermissions((p) => ({ ...p, editing }))}
          />
          <Choice
            label="Joining"
            value={permissions.joining}
            options={[
              ["anyone", "Anyone can join"],
              ["approval", "Require approval"],
            ]}
            onChange={(joining) => setPermissions((p) => ({ ...p, joining }))}
          />
          <div className="azm-field">
            <span>Members can</span>
            <Toggle
              label="Create polls"
              value={permissions.polls}
              onChange={(value) => setPermissions((p) => ({ ...p, polls: value }))}
            />
            <Toggle
              label="Create events"
              value={permissions.events}
              onChange={(value) => setPermissions((p) => ({ ...p, events: value }))}
            />
          </div>
          <div className="azm-sheet-actions">
            <Primary className="secondary" onClick={() => setStep(1)}>
              Back
            </Primary>
            <Primary onClick={save}>{group ? "Save Changes" : "Create Group"}</Primary>
          </div>
        </>
      )}
    </Sheet>
  );
}

/**
 * A single choice shown as the app's chips (the Add Item category row): one
 * tap picks, the picked chip turns brand red. Used instead of <select>, so
 * Messages forms look like the rest of the app.
 */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="azm-field" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div className="azm-choice">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={value === v ? "active" : ""}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
