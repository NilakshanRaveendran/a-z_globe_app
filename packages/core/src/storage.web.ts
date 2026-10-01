/**
 * Values this page could not hand to localStorage — because it is blocked
 * (Safari private/restricted contexts) or full. For those keys the page's own
 * copy wins, so the session stays usable; `null` records a removal.
 *
 * Everything else is read straight from localStorage every time, so two tabs
 * (say, a customer tab and a business tab of the demo) always see each other's
 * writes instead of a copy frozen when the page loaded (audit S38).
 */
const memory = new Map<string, string | null>();

export function createStorage({ id }: { id: string }) {
  const keyFor = (key: string) => `${id}:${key}`;
  return {
    getString(key: string): string | undefined {
      const name = keyFor(key);
      if (memory.has(name)) return memory.get(name) ?? undefined;
      try {
        return globalThis.localStorage.getItem(name) ?? undefined;
      } catch {
        return undefined;
      }
    },
    set(key: string, value: string): void {
      const name = keyFor(key);
      try {
        globalThis.localStorage.setItem(name, value);
        memory.delete(name);
      } catch {
        // Blocked or full: keep this page's copy so the session still works.
        memory.set(name, value);
      }
    },
    remove(key: string): void {
      const name = keyFor(key);
      try {
        globalThis.localStorage.removeItem(name);
        memory.delete(name);
      } catch {
        // Browser storage is unavailable; hide the value for this session.
        memory.set(name, null);
      }
    },
  };
}
