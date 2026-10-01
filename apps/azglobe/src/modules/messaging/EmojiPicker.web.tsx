import { useEffect, useState } from "react";
import { init, SearchIndex } from "emoji-mart";
import data from "@emoji-mart/data";
import { MIcon } from "./ui.web";

type Emoji = { id: string; name: string; skins: { native: string }[] };
const catalogue = data as {
  categories: { id: string; emojis: string[] }[];
  emojis: Record<string, Emoji>;
};
init({ data });

/** Emoji Mart supplies search/data; all visible controls keep the app's MUI style. */
export function EmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("people");
  const [results, setResults] = useState<Emoji[]>([]);
  const [skin, setSkin] = useState(0);
  useEffect(() => {
    let live = true;
    if (query.trim())
      void SearchIndex.search(query).then((matches: Emoji[]) => {
        if (live) setResults(matches ?? []);
      });
    return () => {
      live = false;
    };
  }, [query]);
  const emojis = query.trim()
    ? results
    : (catalogue.categories.find((c) => c.id === category)?.emojis ?? [])
        .map((id) => catalogue.emojis[id])
        .filter((e): e is Emoji => !!e);
  return (
    <>
      <div className="azm-search">
        <MIcon name="search" />
        <input
          placeholder="Search emoji"
          aria-label="Search emoji"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="azm-chips">
        {catalogue.categories.map((c) => (
          <button
            key={c.id}
            className={c.id === category ? "active" : ""}
            onClick={() => {
              setCategory(c.id);
              setQuery("");
            }}
          >
            {c.id.charAt(0).toUpperCase() + c.id.slice(1)}
          </button>
        ))}
      </div>
      <label className="azm-field">
        <span>Skin tone</span>
        <select value={skin} onChange={(e) => setSkin(Number(e.target.value))}>
          {[
            "Default",
            "Light",
            "Medium-light",
            "Medium",
            "Medium-dark",
            "Dark",
          ].map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="azm-emoji-grid">
        {emojis.map((emoji) => (
          <button
            key={emoji.id}
            aria-label={emoji.name}
            title={emoji.name}
            onClick={() =>
              onSelect((emoji.skins[skin] ?? emoji.skins[0])!.native)
            }
          >
            {(emoji.skins[skin] ?? emoji.skins[0])!.native}
          </button>
        ))}
      </div>
      {!emojis.length && <p>No emoji found</p>}
    </>
  );
}
