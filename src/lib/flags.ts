/**
 * The flag queue's storage (§6b).
 *
 * localStorage, deliberately. No backend, no auth, no database — this is a
 * single-user site and the flags only need to survive until he exports them.
 * §2 rules out accounts entirely, and anything more elaborate than this would
 * be building infrastructure for a user base of one.
 *
 * Client-only. Every function guards on `window` so importing this from a
 * server component can't blow up at build time.
 */

const KEY = "field-guide.flags.v1";

/** Fired on any mutation so open views re-read without prop-drilling. */
export const FLAGS_CHANGED = "field-guide:flags-changed";

export type Flag = {
  id: string;
  /** Exactly what he selected. */
  phrase: string;
  /** The sentence it sat in, so the flag still makes sense a week later. */
  sentence: string;
  /** Route it was flagged on, e.g. /glossary/dead-money. */
  path: string;
  /** Page title, for reading the queue without decoding URLs. */
  pageTitle: string;
  /**
   * The repo file to edit, where the route maps to one. §6b asks for the
   * source file; for content routes we can name it exactly, and for anything
   * else it's honestly null rather than a guess.
   */
  sourceFile: string | null;
  createdAt: string;
  /** Kept after export rather than deleted — §6b wants the history. */
  exportedAt: string | null;
};

const CONTENT_ROUTES = [
  "glossary",
  "positions",
  "teams",
  "moves",
  "calendar",
  "rivalries",
];

/** /glossary/dead-money → content/glossary/dead-money.mdx */
export function sourceFileFor(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [type, slug] = parts;
  return CONTENT_ROUTES.includes(type) ? `content/${type}/${slug}.mdx` : null;
}

function read(): Flag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Flag[]) : [];
  } catch {
    // A corrupted or unparseable value shouldn't take the page down. Losing
    // flags is bad; a white screen he can't recover from is worse.
    return [];
  }
}

/**
 * Cached snapshot for useSyncExternalStore.
 *
 * That hook compares snapshots by identity, so returning a freshly-sorted
 * array on every call would loop forever. The cache is invalidated on write
 * and nowhere else, which makes the reference stable between mutations.
 */
let cache: Flag[] | null = null;
const EMPTY: Flag[] = [];

function write(flags: Flag[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(flags));
  } catch {
    // Quota or private-mode failure. Nothing useful to do here.
  }
  cache = null;
  window.dispatchEvent(new CustomEvent(FLAGS_CHANGED));
}

export function getFlags(): Flag[] {
  if (typeof window === "undefined") return EMPTY;
  if (!cache) {
    cache = read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return cache;
}

/** Server render and hydration both see an empty queue; localStorage is client-only. */
export function getServerFlags(): Flag[] {
  return EMPTY;
}

export function subscribe(onChange: () => void): () => void {
  window.addEventListener(FLAGS_CHANGED, onChange);
  // Another tab writing to localStorage fires `storage`, not our custom event.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FLAGS_CHANGED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function pendingCount(): number {
  return getFlags().filter((f) => !f.exportedAt).length;
}

export function addFlag(input: {
  phrase: string;
  sentence: string;
  path: string;
  pageTitle: string;
}): Flag {
  const flag: Flag = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    phrase: input.phrase,
    sentence: input.sentence,
    path: input.path,
    pageTitle: input.pageTitle,
    sourceFile: sourceFileFor(input.path),
    createdAt: new Date().toISOString(),
    exportedAt: null,
  };
  write([flag, ...read()]);
  return flag;
}

export function removeFlag(id: string) {
  write(read().filter((f) => f.id !== id));
}

/** Stamps everything currently unexported. Called after a successful copy. */
export function markAllExported() {
  const now = new Date().toISOString();
  write(read().map((f) => (f.exportedAt ? f : { ...f, exportedAt: now })));
}

/** What lands on the clipboard — shaped to be useful pasted into Claude Code. */
export function exportPayload(flags: Flag[]) {
  return {
    exportedAt: new Date().toISOString(),
    count: flags.length,
    flags: flags.map((f) => ({
      phrase: f.phrase,
      sentence: f.sentence,
      page: f.pageTitle,
      path: f.path,
      sourceFile: f.sourceFile,
      flaggedAt: f.createdAt,
    })),
  };
}
