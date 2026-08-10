import { getAllEntries, getEntry, getSlugs } from "@/lib/content";
import type {
  Frontmatter,
  MoveMeta,
  MoveSource,
  RubricScore,
} from "@/lib/content/schema";
import { team } from "@/lib/teams";

/**
 * Moves, read from content/moves/*.mdx.
 *
 * This replaces src/lib/mock/moves.ts, which was the last content type still
 * hard-coded in TypeScript. The move that mattered most: Krish's first-ever
 * flag came from a Moves page and reported its source file as
 * content/moves/2026-06-garrett-to-rams.mdx — a file that didn't exist. Now it
 * does, so the flag queue can point at something editable (§6b).
 *
 * The split inside a move file: frontmatter carries §7's rubric, because six
 * scores plus prose is structured data and parsing it back out of a body would
 * be fragile. The MDX body carries the "so what" — the part that's genuinely
 * prose. Both halves get glossary auto-linking, by different routes: the body
 * through MdxContent, the axis notes through createExplainer.
 *
 * No new filesystem code. Everything here goes through src/lib/content.
 */

export type { MoveSource, RubricScore } from "@/lib/content/schema";

export type Move = {
  slug: string;
  /** Frontmatter `title`. Named headline at the call sites. */
  headline: string;
  /** Sortable: 2026, 2026-03 or 2026-03-12. */
  date: string;
  /** Human-readable at whatever precision is actually known. */
  dateLabel: string;
  teams: string[];
  bigness: number;
  /** One sentence: why a newcomer should care at all. */
  soWhat: string;
  rubric: RubricScore[];
  verified: boolean;
  /** Reporting to link out to (§9). */
  sources: MoveSource[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "2026" → "2026 offseason", "2026-06" → "June 2026", "2026-03-12" → "12 March 2026".
 *
 * Renders each date at the precision we actually have rather than padding it
 * out to a day nobody reported.
 */
export function formatMoveDate(date: string): string {
  const [year, month, day] = date.split("-");
  if (!month) return `${year} offseason`;
  const name = MONTHS[Number(month) - 1] ?? month;
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`;
}

/**
 * §13's abbreviation trap, caught at build time.
 *
 * Team ids are typed by hand in frontmatter, and this project has already been
 * bitten three times by a plausible-looking abbreviation that matched nothing
 * (WAS vs WSH). An unknown id here would silently render a card with no logo,
 * so fail the build and name the file instead.
 */
function checkTeams(slug: string, ids: string[]) {
  const unknown = ids.filter((id) => !team(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown team id ${unknown.join(", ")} in content/moves/${slug}.mdx — ` +
        `check it against src/lib/teams/nfl-teams.json (WSH, not WAS).`,
    );
  }
}

/** The `move:` block is required on type: moves, so this is a schema bug if it fires. */
function meta(frontmatter: Frontmatter): MoveMeta {
  if (!frontmatter.move) {
    throw new Error(
      `content/moves/${frontmatter.slug}.mdx has no move: block, which the schema should have caught.`,
    );
  }
  return frontmatter.move;
}

function toMove(frontmatter: Frontmatter): Move {
  const m = meta(frontmatter);
  checkTeams(frontmatter.slug, m.teams);
  return {
    slug: frontmatter.slug,
    headline: frontmatter.title,
    date: m.date,
    dateLabel: formatMoveDate(m.date),
    teams: m.teams,
    bigness: m.bigness,
    soWhat: frontmatter.summary,
    rubric: m.rubric,
    verified: m.verified,
    sources: m.sources,
  };
}

export function getMoveSlugs(): string[] {
  return getSlugs("moves");
}

/** Every move, biggest first. Ties break newest-first so ordering is stable. */
export function getMoves(): Move[] {
  return getAllEntries("moves")
    .map(toMove)
    .sort((a, b) => b.bigness - a.bigness || b.date.localeCompare(a.date));
}

export function getMovesForTeam(id: string): Move[] {
  return getMoves().filter((m) => m.teams.includes(id));
}

/** One move plus its MDX body, or null for a 404. */
export function getMove(slug: string): (Move & { body: string }) | null {
  const entry = getEntry("moves", slug);
  if (!entry) return null;
  return { ...toMove(entry.frontmatter), body: entry.body };
}
