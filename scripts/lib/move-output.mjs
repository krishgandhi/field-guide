/**
 * Where a drafted move is written, decided before anything touches disk.
 *
 * Three ways the write used to go wrong:
 *   - Two drafts in one run with the same slug: the second silently
 *     overwrote the first.
 *   - A slug matching an entry already committed: the file was overwritten,
 *     and the workflow's "never modify an existing move" step then failed the
 *     whole job — taking every other refreshed file down with it.
 *   - The held path used the model's slug as given. A "/" in it pointed the
 *     write at a directory that doesn't exist, and the crash came before
 *     seen-news and the worklist were saved, so the same candidates came back
 *     the next day to crash again.
 *
 * Now the slug is sanitised before any path is built, a publish that would
 * land on an existing file is held instead (with a reason), and a held file
 * never overwrites another held file. None of this can fail the job.
 */

import { existsSync } from "node:fs";

/** Lowercase kebab-case, path-safe, never empty. */
export function sanitiseSlug(raw) {
  const slug = String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "untitled";
}

/**
 * The file one draft goes to.
 *
 * `slug` must already be sanitised. Returns { file, held, reason } — `reason`
 * is set when a publishable draft was held only because its slug is taken.
 * `exists` is injectable for tests.
 */
export function targetFor({ slug, held, publishedDir, heldDir, exists = (file) => existsSync(file) }) {
  if (!held) {
    const file = `${publishedDir}/${slug}.mdx`;
    if (!exists(file)) return { file, held: false, reason: null };
    return { ...heldTarget(slug, heldDir, exists), reason: `${file} already exists; never overwritten` };
  }
  return { ...heldTarget(slug, heldDir, exists), reason: null };
}

function heldTarget(slug, heldDir, exists) {
  let file = `${heldDir}/${slug}.mdx`;
  for (let n = 2; exists(file); n++) file = `${heldDir}/${slug}-${n}.mdx`;
  return { file, held: true };
}
