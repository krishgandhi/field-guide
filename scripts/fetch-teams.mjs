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
 *    clears the threshold. The UI renders `displayColor`; `brandColor` is kept
 *    only for reference. This is §13's "normalize once, in one place".
 */

import { mkdir, writeFile, stat, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const TEAMS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const LOGO = (abbr) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${abbr.toLowerCase()}.png`;

const LOGO_DIR = "public/logos";
const OUT_JSON = "src/lib/teams/nfl-teams.json";

/** Must match --ink in globals.css. */
const INK = "#0A0C0B";
const MIN_CONTRAST = 4.5;
const LOGO_PX = 256;

// ---------- colour maths (WCAG contrast + HSL lightening) ----------

const hex2rgb = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};

const luminance = (hex) => {
  const [r, g, b] = hex2rgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

function rgb2hsl(hex) {
  const [r, g, b] = hex2rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0))
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hsl2hex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Lift lightness in 1% steps until the colour clears MIN_CONTRAST on INK. */
function lift(hex) {
  if (contrast(hex, INK) >= MIN_CONTRAST) return hex;
  const [h, s] = rgb2hsl(hex);
  for (let l = 0.3; l <= 0.95; l += 0.01) {
    const candidate = hsl2hex(h, s, l);
    if (contrast(candidate, INK) >= MIN_CONTRAST) return candidate;
  }
  return "#FFFFFF"; // unreachable in practice; a visible fallback beats an invisible one
}

const isAchromatic = (hex) => rgb2hsl(hex)[1] < 0.15;

/**
 * Pick the colour to actually render, then make it legible.
 *
 * Teams whose primary is black — Steelers, Raiders — can't be lifted usefully:
 * lightening black only ever yields grey, which is nobody's team colour. For
 * those we fall back to ESPN's alternateColor, which is the gold and the silver
 * people actually associate with them.
 */
function toDisplayColor(brand, alternate) {
  const base =
    isAchromatic(brand) && alternate && !isAchromatic(alternate)
      ? alternate
      : brand;
  return lift(base);
}

// ---------- fetch ----------

const res = await fetch(TEAMS_URL);
if (!res.ok) throw new Error(`ESPN teams endpoint returned ${res.status}`);
const raw = await res.json();
const list = raw.sports[0].leagues[0].teams.map((t) => t.team);

if (list.length !== 32) {
  throw new Error(`Expected 32 teams, got ${list.length}. Aborting.`);
}

await rm(LOGO_DIR, { recursive: true, force: true });
await mkdir(LOGO_DIR, { recursive: true });
await mkdir("src/lib/teams", { recursive: true });

const teams = [];

for (const t of list) {
  const abbr = t.abbreviation.toUpperCase();
  const file = `${LOGO_DIR}/${abbr.toLowerCase()}.png`;

  const img = await fetch(LOGO(abbr));
  const buf = Buffer.from(await img.arrayBuffer());

  // The CDN returns 200 with a zero-length body intermittently — status alone
  // is not proof of success, so check the bytes.
  if (!img.ok || buf.length < 1000) {
    throw new Error(
      `Logo for ${abbr} came back ${img.status} with ${buf.length} bytes. Aborting rather than shipping a broken image.`,
    );
  }

  await writeFile(file, buf);
  await run("sips", ["-Z", String(LOGO_PX), file]);

  const resized = await stat(file);
  if (resized.size < 500) throw new Error(`${abbr} resize produced garbage`);

  const brandColor = `#${(t.color ?? "888888").replace("#", "").toUpperCase()}`;
  const altColor = t.alternateColor
    ? `#${t.alternateColor.replace("#", "").toUpperCase()}`
    : null;
  const displayColor = toDisplayColor(brandColor, altColor).toUpperCase();

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
    `  ${abbr.padEnd(4)} ${displayColor} ${contrast(displayColor, INK).toFixed(1).padStart(4)}:1  ${(resized.size / 1024).toFixed(0)}KB${lifted}`,
  );
}

teams.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(OUT_JSON, `${JSON.stringify(teams, null, 2)}\n`);

const failing = teams.filter((t) => contrast(t.displayColor, INK) < MIN_CONTRAST);
if (failing.length) {
  throw new Error(`${failing.length} display colours below ${MIN_CONTRAST}:1`);
}

console.log(
  `\n${teams.length} teams → ${OUT_JSON}\n${teams.length} logos → ${LOGO_DIR}/ (all ≥ ${MIN_CONTRAST}:1 on ${INK})`,
);
