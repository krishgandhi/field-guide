import { getAllEntries } from "@/lib/content";

/**
 * The glossary term index (§6a).
 *
 * Built once from `content/glossary/*` frontmatter — title plus aliases —
 * never computed per request. §13 is explicit about this: the index touches
 * every page, so it must be built, not recalculated. `getAllEntries` reads
 * frontmatter without compiling any MDX, so building it costs one directory
 * read regardless of how many entries exist.
 */

export type GlossaryTerm = {
  slug: string;
  title: string;
  summary: string;
};

/** Every matchable string → the entry it belongs to. Keys are lowercased. */
function buildIndex(): Map<string, GlossaryTerm> {
  const index = new Map<string, GlossaryTerm>();

  for (const entry of getAllEntries("glossary")) {
    const target: GlossaryTerm = {
      slug: entry.slug,
      title: entry.title,
      summary: entry.summary,
    };
    for (const term of [entry.title, ...entry.aliases]) {
      const key = term.toLowerCase().trim();
      // First writer wins. A duplicate across two entries would make matching
      // order arbitrary; the content check in the last content pass asserts
      // there aren't any, so this is a guard, not a routine path.
      if (key && !index.has(key)) index.set(key, target);
    }
  }

  return index;
}

const INDEX = buildIndex();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One regex over all terms, alternatives ordered longest-first.
 *
 * That ordering is what satisfies §6a's "match on longest term first, so
 * 'play action pass' wins over 'pass'". JS alternation is leftmost-first: at a
 * given position it tries alternatives in the order written, so listing the
 * longest first makes it prefer the longest match there. The regex engine
 * still finds the earliest position in the string on its own.
 *
 * `\b` on both sides stops "cap" matching inside "capable". It behaves
 * correctly for multi-word and hyphenated terms too, since those start and end
 * on word characters.
 */
function buildPattern(): RegExp | null {
  const terms = [...INDEX.keys()].sort((a, b) => b.length - a.length);
  if (terms.length === 0) return null;
  return new RegExp(`\\b(?:${terms.map(escapeRe).join("|")})\\b`, "gi");
}

const PATTERN = buildPattern();

export type Match = {
  /** Where the match starts in the source string. */
  index: number;
  /** The matched text exactly as written, so original casing is preserved. */
  text: string;
  entry: GlossaryTerm;
};

/**
 * Find the glossary terms in a string that should become links.
 *
 * `linked` is the set of slugs already linked on this page; it is READ AND
 * MUTATED, which is how "link only the first occurrence per page" is enforced
 * across many separate text nodes. Callers create one set per page.
 *
 * First occurrence is tracked per *entry*, not per string — once "dead money"
 * is linked, the alias "dead cap" further down stays plain text. Two links to
 * the same explanation is the visual noise §6a is trying to avoid.
 */
export function findTerms(
  value: string,
  { linked, currentSlug }: { linked: Set<string>; currentSlug?: string },
): Match[] {
  if (!PATTERN) return [];

  const found: Match[] = [];
  PATTERN.lastIndex = 0;

  for (const m of value.matchAll(PATTERN)) {
    const entry = INDEX.get(m[0].toLowerCase());
    if (!entry) continue;
    // §6a: never let an entry auto-link to itself.
    if (entry.slug === currentSlug) continue;
    if (linked.has(entry.slug)) continue;

    linked.add(entry.slug);
    found.push({ index: m.index, text: m[0], entry });
  }

  return found;
}

/** Exposed for the content checks and for debugging the index. */
export function allTerms(): string[] {
  return [...INDEX.keys()].sort((a, b) => b.length - a.length);
}
