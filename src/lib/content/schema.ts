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
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;
