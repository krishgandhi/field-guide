/**
 * Resolves the app's "@/..." import alias for plain `node` runs.
 *
 * Next and tsc both read the alias from tsconfig; Node does not. Without this,
 * the scoring checks would have to import through relative paths, which means
 * testing a copy of the import graph rather than the real one.
 *
 * Registered by scripts/register-alias.mjs — exporting `resolve` from a file
 * that is merely `--import`ed does nothing; the hook has to go through
 * module.register.
 */

import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Node demands an explicit `with { type: "json" }`; Turbopack doesn't.
 *
 * The attribute has to be set on the RESULT of resolve — passing a modified
 * context into next() does nothing, because validation reads what resolve
 * returned. Injecting it here keeps the app source in the form Next expects
 * instead of contorting it to satisfy a test runner.
 */
function tagJson(result) {
  return result.url.endsWith(".json")
    ? { ...result, importAttributes: { ...result.importAttributes, type: "json" } }
    : result;
}

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) {
    // Catches relative JSON too, e.g. `import data from "./nfl-teams.json"`.
    return tagJson(await next(specifier, context));
  }

  const base = path.join(ROOT, "src", specifier.slice(2));
  // Some targets are files (@/lib/watchability), some are directories with an
  // index (@/lib/teams), and some already carry an extension (@/data/*.json).
  const candidates = path.extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    return tagJson(await next(pathToFileURL(candidate).href, context));
  }
  throw new Error(`Could not resolve "${specifier}" (tried: ${candidates.join(", ")})`);
}
