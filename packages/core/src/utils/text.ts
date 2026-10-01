/**
 * Unicode-safe text helpers.
 *
 * Names in this app come in Sinhala, Tamil and English, and people put emoji in
 * group names. `str[0]` / `charAt(0)` take one UTF-16 code unit, which is half
 * of an emoji (drawn as "�") and can split a letter from the vowel sign that
 * belongs to it. These work on grapheme clusters — what a reader sees as one
 * character — using Intl.Segmenter where the runtime has it, and whole code
 * points everywhere else.
 */

type Segmenter = { segment(input: string): Iterable<{ segment: string }> };

let segmenter: Segmenter | null | undefined;
function getSegmenter(): Segmenter | null {
  if (segmenter === undefined) {
    const Ctor = (Intl as unknown as { Segmenter?: new (locale?: string, options?: object) => Segmenter })
      .Segmenter;
    segmenter = Ctor ? new Ctor(undefined, { granularity: 'grapheme' }) : null;
  }
  return segmenter;
}

/** The user-perceived characters of `text`. */
export function graphemes(text: string): string[] {
  const s = getSegmenter();
  return s ? Array.from(s.segment(text), (part) => part.segment) : Array.from(text);
}

/** The first user-perceived character, or '' for blank text. */
export function firstGrapheme(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const s = getSegmenter();
  if (s) {
    for (const part of s.segment(trimmed)) return part.segment;
  }
  return Array.from(trimmed)[0] ?? '';
}

/**
 * Avatar initials: the first character of up to `max` words, upper-cased where
 * the script has case — "Priya Selvaraj" → "PS", "தமிழ் செல்வி" → "தசெ",
 * "🍛 Food Lovers" → "🍛F". Falls back to `fallback` for blank names.
 */
export function initials(name: string, max = 2, fallback = '?'): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, max);
  const out = words.map((word) => firstGrapheme(word).toLocaleUpperCase()).join('');
  return out || fallback;
}

/** `text` cut to at most `max` characters without splitting one, with an ellipsis. */
export function truncate(text: string, max: number): string {
  const parts = graphemes(text);
  return parts.length <= max ? text : `${parts.slice(0, Math.max(0, max - 1)).join('')}…`;
}

/** Length as a reader counts it — an emoji or a Tamil syllable is one. */
export function visibleLength(text: string): number {
  return graphemes(text).length;
}
