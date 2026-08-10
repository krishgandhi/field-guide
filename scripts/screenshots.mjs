/**
 * Screenshot every screen at phone and desktop width.
 *
 * Why this exists: CLAUDE.md §10 sets a visual quality floor — responsive to
 * 380px, 44px tap targets, readable type — and until now nothing checked it.
 * Structural greps catch "this will break"; only a picture catches "this looks
 * wrong".
 *
 * Usage:
 *   npm run build && npm start    # in one terminal
 *   npm run shots                 # in another
 *
 * Shoot a PRODUCTION build, not `next dev`. Dev injects the Next.js dev-tools
 * badge, which lands in the corner of every screenshot and obscures the nav.
 *
 * Two captures per screen, because they show different things:
 *   -view  viewport only. This is what the phone actually shows, and the only
 *          one where `position: sticky` behaves — fullPage expands the viewport
 *          to the document height, which strands sticky elements mid-page.
 *   -full  whole document, for reading the layout end to end.
 *
 * Output lands in .screenshots/ (gitignored — images don't belong in the repo).
 * Override the target with BASE_URL=https://… npm run shots to shoot production.
 */

import { chromium } from "playwright";
import { mkdir, rm } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = ".screenshots";

// 380 is the §10 floor — the width the design must survive. 1024 is a sanity
// check that nothing is broken on a laptop.
const VIEWPORTS = [
  { name: "phone", width: 380, height: 820 },
  { name: "desktop", width: 1024, height: 900 },
];

const SCREENS = [
  ["this-week", "/"],
  ["games", "/games"],
  ["moves", "/moves"],
  ["move-detail", "/moves/2026-06-garrett-to-rams"],
  ["move-no-rubric", "/moves/2026-01-brady-replaces-mcdermott"],
  ["teams", "/teams"],
  ["team-written", "/teams/buffalo-bills"],
  ["team-unwritten", "/teams/chicago-bears"],  // keep pointing at a team with no write-up
  ["glossary", "/glossary"],
  ["glossary-entry", "/glossary/dead-money"],
];

const res = await fetch(BASE).catch(() => null);
if (!res?.ok) {
  console.error(`No server at ${BASE}. Start one with: npm run dev`);
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });

  for (const [name, path] of SCREENS) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    // Fonts are the thing most likely to still be swapping when the network
    // goes quiet, and they're half of what we're checking.
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: `${OUT}/${vp.name}-${name}-view.png` });
    await page.screenshot({
      path: `${OUT}/${vp.name}-${name}-full.png`,
      fullPage: true,
    });
    console.log(`  ${vp.name.padEnd(8)} ${path}`);
  }

  await page.close();
}

await browser.close();
console.log(
  `\nWrote ${VIEWPORTS.length * SCREENS.length * 2} screenshots to ${OUT}/`,
);
