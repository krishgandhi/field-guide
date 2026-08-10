import { z } from "zod";

/**
 * The six content directories from CLAUDE.md §5. The array is the source of
 * truth: it drives the zod enum, the TypeScript union, and the directory
 * lookup in the loader, so adding a seventh type is a one-line change.
 */
export const CONTENT_TYPES = [
  "glossary",
  "positions",
  "teams",
  "moves",
  "calendar",
  "rivalries",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * YAML parses an unquoted `2026-07-29` into a JS Date, but a quoted
 * "2026-07-29" stays a string. Accept either and normalise to YYYY-MM-DD so
 * everything downstream gets one shape.
 */
const isoDate = z
  .union([z.date(), z.string()])
  .transform((value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value.trim(),
  )
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD form"),
  );

const slug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be lowercase words joined by hyphens, e.g. dead-money",
  );

/** §7's six axes, in the spec's order. A move scores all six or none. */
export const RUBRIC_AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
] as const;

const rubricScore = z.strictObject({
  axis: z.enum(RUBRIC_AXES),
  score: z.number().int().min(1).max(5),
  /** Two sentences, max — §5's word budget for a move. */
  note: z.string().min(1),
});

/**
 * A move's date, at whatever precision is actually known: 2026, 2026-03 or
 * 2026-03-12.
 *
 * Not `isoDate`, deliberately. Reporting gives "a post-June 1 trade" or "the
 * 2026 offseason" and pinning that to a day means inventing one — the exact
 * confident guess §3 rules out. All three forms still sort correctly as
 * strings, and the UI renders each at its own precision.
 */
const partialDate = z
  .union([z.date(), z.string()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v.trim()))
  .pipe(
    z
      .string()
      .regex(
        /^\d{4}(-\d{2}(-\d{2})?)?$/,
        "must be YYYY, YYYY-MM or YYYY-MM-DD — quote it so YAML keeps it a string",
      ),
  );

/**
 * Where the facts came from (§9).
 *
 * The copyright rule is summarise in original words, never reproduce article
 * text, always link to the source. We had the first two and not the third, so
 * every entry dead-ended at my summary with no way to go and read the actual
 * reporting.
 */
const source = z.strictObject({
  /** The publisher, as a reader would name it: "ESPN", "NFL.com". */
  label: z.string().min(1),
  url: z.url().startsWith("https://", "must be an https:// link"),
});

/**
 * Structured half of a move entry.
 *
 * §7's rubric is data — six axes, each a score plus prose — so it lives in
 * frontmatter where it can be read without parsing the body. The MDX body
 * carries the "so what". Both halves get glossary auto-linking, by different
 * routes: the body through MdxContent, these notes through createExplainer.
 *
 * Strict like its parent, so a typo inside `move:` fails the build too.
 */
const move = z.strictObject({
  date: partialDate,
  /** Team abbreviations. Cross-checked against the real 32 in the loader. */
  teams: z.array(z.string().regex(/^[A-Z]{2,3}$/)).min(1),
  /**
   * 1–5, "how big is this actually".
   *
   * Deliberately NOT the mean of the six axes. Averaging inflates routine
   * moves: a quarterback restructure scores 5 on player quality and 5 on
   * positional value before anything has happened, dragging a piece of
   * paperwork up to ~3.3. The axes explain a move; this number ranks it.
   */
  bigness: z.number().int().min(1).max(5),
  /** True only for entries built from events verified against a source. */
  verified: z.boolean(),
  /**
   * Reporting to link out to. Optional in the schema because a draft won't
   * always have one; test:moves reports any `verified: true` entry missing it.
   */
  sources: z.array(source).default([]),
  /**
   * All six axes or none. A partial set is always a half-written entry, and
   * the empty case is real: §7 doesn't apply to a coaching change.
   */
  rubric: z
    .array(rubricScore)
    .refine(
      (axes) => axes.length === 0 || axes.length === RUBRIC_AXES.length,
      `must score all ${RUBRIC_AXES.length} axes from §7, or none at all`,
    )
    .refine(
      (axes) => new Set(axes.map((a) => a.axis)).size === axes.length,
      "must not score the same axis twice",
    ),
});

export type RubricAxis = (typeof RUBRIC_AXES)[number];
export type RubricScore = z.infer<typeof rubricScore>;
export type MoveSource = z.infer<typeof source>;
export type MoveMeta = z.infer<typeof move>;

/**
 * The frontmatter every content file carries (CLAUDE.md §5).
 *
 * Deliberately strict: an unknown key is an error, not something to ignore.
 * A typo like `reviwed:` would otherwise fall back to the default and render
 * a page that looks fine but silently isn't what was written.
 */
export const frontmatterSchema = z.strictObject({
  title: z.string().min(1),
  slug,
  type: z.enum(CONTENT_TYPES),
  /** Extra strings that also trigger glossary auto-linking (§6a). */
  aliases: z.array(z.string().min(1)).default([]),
  /** One sentence. Shown in the hover card / bottom sheet. */
  summary: z.string().min(1),
  /** True once Krish has read it. Renders a marker in development only. */
  reviewed: z.boolean().default(false),
  /** Jargon he flagged inside this entry (§6b). */
  flaggedTerms: z.array(z.string().min(1)).default([]),
  lastUpdated: isoDate,
  /** Only on `type: moves`. Enforced below. */
  move: move.optional(),
}).refine((fm) => (fm.type === "moves") === (fm.move !== undefined), {
  path: ["move"],
  error: "a `move:` block is required on type: moves and allowed nowhere else",
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;
