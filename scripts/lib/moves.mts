/**
 * Move entries as scripts see them: parsed frontmatter plus the body.
 *
 * Scripts used to pull single fields out of the MDX with line regexes
 * (`^  people: \[...\]`, `^summary: (.+)$`). Those only worked while every
 * file happened to be formatted the same way — a quoted summary, a block-style
 * list or a folded title would have silently returned nothing. gray-matter
 * is the parser the app itself uses (src/lib/content), so scripts and pages
 * now read the same YAML the same way.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const MOVES_DIR = "content/moves";
export const DRAFTS_DIR = "content/moves/_drafts";

/** The subset of the frontmatter scripts read. The app's zod schema is the full contract. */
export type MoveEntry = {
  file: string;
  title: string;
  summary: string;
  move: {
    teams: string[];
    people: string[];
    bigness?: number;
    rubric: { axis: string; score: number; note: string }[];
  };
  body: string;
};

/** Every .mdx entry in `dir` (published moves by default; pass DRAFTS_DIR for held ones). */
export function readMoves(dir: string = MOVES_DIR): MoveEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .sort()
    .map((file) => {
      const { data, content } = matter(readFileSync(path.join(dir, file), "utf8"));
      const move = data.move ?? {};
      return {
        file,
        title: String(data.title ?? ""),
        summary: String(data.summary ?? ""),
        move: {
          teams: (move.teams ?? []).map(String),
          // YAML reads an unquoted id as a number; ids are strings everywhere else.
          people: (move.people ?? []).map(String),
          bigness: move.bigness,
          rubric: move.rubric ?? [],
        },
        body: content,
      };
    });
}
