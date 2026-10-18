/**
 * Turn a drafted move into an MDX file, and refuse to publish one the site
 * could not build.
 *
 * The frontmatter used to be assembled by string interpolation: `title:
 * ${entry.title}`. A title containing a colon, a leading quote or a `#` is
 * then broken YAML, and because the content loader validates every entry at
 * build time, one bad generated file failed the whole Vercel build — the
 * pipeline could take the site down with a headline like "Bills: what now?".
 *
 * Now the frontmatter is serialised by a YAML library (gray-matter's
 * stringify, which is js-yaml), and every file is read back through
 * gray-matter and the app's own zod schema before it is written to
 * content/moves. A file that fails goes to _drafts like any other held draft.
 *
 * .mjs rather than .mts because it imports the app's schema by its .ts path,
 * which Node runs directly but tsc only allows from plain JavaScript.
 */

import matter from "gray-matter";
import { moveRuleProblems } from "./move-rules.mjs";
import { frontmatterSchema } from "../../src/lib/content/schema.ts";
import nflTeams from "../../src/lib/teams/nfl-teams.json" with { type: "json" };

const TEAM_IDS = new Set(nflTeams.map((t) => t.id));

/**
 * The full MDX text for one drafted entry.
 *
 * `move` is the structured block; everything in it comes from the candidate
 * or from fields problemsWith() has already checked.
 */
export function buildMoveFile({ entry, candidate, slug, date, teams, sensitive, today }) {
  const data = {
    title: String(entry.title ?? "").trim(),
    slug,
    type: "moves",
    summary: String(entry.summary ?? "").trim(),
    reviewed: false,
    lastUpdated: today,
    move: {
      date,
      kind: entry.kind,
      teams,
      bigness: entry.bigness,
      // Machine-written from a single headline: verified stays false until a
      // human has read it against the reporting linked in sources.
      verified: false,
      sensitive,
      sources: [{ label: "ESPN", url: candidate.url }],
      people: (candidate.players ?? []).map((p) => p.id).filter(Boolean).map(String),
      rubric: (entry.rubric ?? []).map((r) => ({
        axis: r.axis,
        score: r.score,
        note: String(r.note ?? "").split(/\s+/).filter(Boolean).join(" "),
      })),
    },
  };
  return matter.stringify(`\n${String(entry.body ?? "").trim()}\n`, data);
}

/**
 * Everything that would stop the site building this file, as strings. Empty
 * means it is safe to put in content/moves.
 *
 * The same checks the build runs: gray-matter parses it, the zod schema
 * accepts it, the slug matches the filename, every team is one of the 32 —
 * plus every rule tests/moves.test.ts holds a committed entry to
 * (scripts/lib/move-rules.mjs), since the data workflow runs those tests
 * before it commits.
 */
export function moveFileProblems(text, slug) {
  let data, content;
  try {
    // A fresh parse every time: gray-matter caches by input string.
    ({ data, content } = matter(text, { cache: false }));
  } catch (err) {
    return [`frontmatter is not valid YAML: ${err.message}`];
  }

  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  }

  const problems = [];
  const fm = parsed.data;
  if (fm.type !== "moves") problems.push(`type is "${fm.type}", not moves`);
  if (fm.move) {
    const unknown = fm.move.teams.filter((t) => !TEAM_IDS.has(t));
    if (unknown.length > 0) problems.push(`unknown team id(s): ${unknown.join(", ")}`);
  }
  // And the rules tests/moves.test.ts holds every committed entry to.
  problems.push(...moveRuleProblems({ file: `${slug}.mdx`, fm: data, move: data.move, body: content }));
  return problems;
}
