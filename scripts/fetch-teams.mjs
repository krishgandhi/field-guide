/**
 * One-off: pull all 32 teams and their logos from ESPN into the repo.
 *
 * Run with `npm run fetch:teams`. Commit the output. Do NOT call this at
 * request time — CLAUDE.md §4 is explicit that pages read only from storage,
 * so the site keeps working when ESPN changes something (and it will; several
 * of these endpoints are undocumented).
 *
 * Three things this handles that aren't obvious:
 *
 * 1. LOGO VARIANT. We take `500-dark`, not `500`. For teams whose logo is
 *    mostly black — Raiders, Jets, Saints — ESPN serves a version with a white
 *    keyline that survives a dark background. For everyone else it returns the
 *    standard logo unchanged, so it's the right default for all 32.
 *
 * 2. SIZE. Despite the `500` in the path these are 4096px, ~490KB each; 32 of
 *    them would put 15MB in the repo. ESPN ignores resize query params and
 *    serves no smaller path, so we downscale locally to 256px with `sips`
 *    (built into macOS — this script is Mac-only by design, and its output is
 *    committed so nobody else needs to run it).
 *
 * 3. CONTRAST. 22 of the 32 official brand colours fail against a dark
 *    background — Buffalo's #00338D manages 1.7:1, which is invisible. So each
 *    team gets a `displayColor`: the brand hue lifted in lightness until it
 *    clears 4.5:1 on both the page ground and the card surface
 *    (scripts/lib/display-color.mjs). The UI renders `displayColor`; `brandColor` is kept
 *    only for reference. This is §13's "normalize once, in one place".
 */

import { mkdir, writeFile, stat, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SITE, getBytes, getJson } from "./lib/espn.mts";
import {
  BACKGROUNDS,
  MIN_CONTRAST,
  toDisplayColor,
  worstContrast,
} from "./lib/display-color.mjs";

const run = promisify(execFile);

const TEAMS_URL = `${SITE}/teams`;
const LOGO = (abbr) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${abbr.toLowerCase()}.png`;

const LOGO_DIR = "public/logos";
const OUT_JSON = "src/lib/teams/nfl-teams.json";

const LOGO_PX = 256;

/**
 * `--colors-only` recomputes displayColor from ESPN's team list and leaves the
 * logos on disk alone. The colours depend on the site's background tokens, so
 * a palette change needs this; it doesn't need 32 fresh 4096px downloads.
 */
const COLORS_ONLY = process.argv.includes("--colors-only");

// ---------- fetch ----------

const raw = await getJson(TEAMS_URL);
const list = raw.sports[0].leagues[0].teams.map((t) => t.team);

if (list.length !== 32) {
  throw new Error(`Expected 32 teams, got ${list.length}. Aborting.`);
}

if (!COLORS_ONLY) {
  await rm(LOGO_DIR, { recursive: true, force: true });
  await mkdir(LOGO_DIR, { recursive: true });
}
await mkdir("src/lib/teams", { recursive: true });

const teams = [];

for (const t of list) {
  const abbr = t.abbreviation.toUpperCase();
  const file = `${LOGO_DIR}/${abbr.toLowerCase()}.png`;

  if (COLORS_ONLY) {
    const kept = await stat(file).catch(() => null);
    if (!kept) throw new Error(`--colors-only, but ${file} is missing. Run without the flag.`);
  } else {
    const buf = await getBytes(LOGO(abbr));

    // The CDN returns 200 with a zero-length body intermittently — status alone
    // is not proof of success, so check the bytes. (A non-200 already threw.)
    if (buf.length < 1000) {
      throw new Error(
        `Logo for ${abbr} came back with ${buf.length} bytes. Aborting rather than shipping a broken image.`,
      );
    }

    await writeFile(file, buf);
    await run("sips", ["-Z", String(LOGO_PX), file]);

    const resized = await stat(file);
    if (resized.size < 500) throw new Error(`${abbr} resize produced garbage`);
  }

  const brandColor = `#${(t.color ?? "888888").replace("#", "").toUpperCase()}`;
  const altColor = t.alternateColor
    ? `#${t.alternateColor.replace("#", "").toUpperCase()}`
    : null;
  const displayColor = toDisplayColor(brandColor, altColor);

  teams.push({
    id: abbr,
    /**
     * ESPN's own numeric id. Needed for `news?team=<id>`, the only feed that
     * returns team-specific stories — the per-game summary endpoint serves the
     * same generic league-wide list for every event.
     */
    espnId: String(t.id),
    slug: t.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    location: t.location,
    name: t.name,
    displayName: t.displayName,
    brandColor,
    displayColor,
    logo: `/logos/${abbr.toLowerCase()}.png`,
  });

  const lifted = brandColor === displayColor ? "" : ` (lifted from ${brandColor})`;
  console.log(
    `  ${abbr.padEnd(4)} ${displayColor} ${worstContrast(displayColor).toFixed(1).padStart(4)}:1${lifted}`,
  );
}

teams.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(OUT_JSON, `${JSON.stringify(teams, null, 2)}\n`);

const failing = teams.filter((t) => worstContrast(t.displayColor) < MIN_CONTRAST);
if (failing.length) {
  throw new Error(`${failing.length} display colours below ${MIN_CONTRAST}:1`);
}

console.log(
  `\n${teams.length} teams → ${OUT_JSON}` +
    (COLORS_ONLY ? " (logos left as they were)" : `\n${teams.length} logos → ${LOGO_DIR}/`) +
    `\nEvery colour ≥ ${MIN_CONTRAST}:1 on night ${BACKGROUNDS.night} and surface ${BACKGROUNDS.surface}.`,
);
