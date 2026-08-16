import { getAllEntries, getEntry, getSlugs } from "@/lib/content";
import type {
  Frontmatter,
  MoveKind,
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

export type { MoveKind, MoveSource, RubricScore } from "@/lib/content/schema";

export type Move = {
  slug: string;
  /** Frontmatter `title`. Named headline at the call sites. */
  headline: string;
  /** YYYY-MM-DD. Sorts correctly as a string. */
  date: string;
  /** "2 June 2026". */
  dateLabel: string;
  kind: MoveKind;
  teams: string[];
  bigness: number;
  /** One sentence: why a newcomer should care at all. */
  soWhat: string;
  rubric: RubricScore[];
  verified: boolean;
  sensitive: boolean;
  /** Reporting to link out to (§9). */
  sources: MoveSource[];
  /** ESPN athlete ids; details come from src/data/people.json. */
  people: string[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-06-02" → "2 June 2026". One format everywhere; the schema guarantees the day. */
export function formatMoveDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
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
    kind: m.kind,
    teams: m.teams,
    bigness: m.bigness,
    soWhat: frontmatter.summary,
    rubric: m.rubric,
    verified: m.verified,
    sensitive: m.sensitive,
    sources: m.sources,
    people: m.people,
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
