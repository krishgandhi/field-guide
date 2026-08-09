/**
 * One-off: capture the two glossary-term interactions, which the normal
 * screenshot run can't reach because they only exist after a hover or a tap.
 *
 * Usage: npm run build && npm start, then
 *   node scripts/shot-glossary-interactions.mjs
 */

import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = ".screenshots";
const URL = `${BASE}/glossary/dead-money`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

// --- desktop: hover card -------------------------------------------------
const desktop = await browser.newContext({
  viewport: { width: 1024, height: 800 },
  deviceScaleFactor: 2,
});
const dp = await desktop.newPage();
await dp.goto(URL, { waitUntil: "networkidle" });
await dp.evaluate(() => document.fonts.ready);
await dp.getByRole("link", { name: "signing bonus" }).hover();
await dp.waitForSelector('[role="dialog"]', { timeout: 5000 });
await dp.screenshot({ path: `${OUT}/interaction-hover-card.png` });
console.log("  hover card captured");
await desktop.close();

// --- touch: bottom sheet -------------------------------------------------
// A real touch context, so the component's `(hover: none)` check takes the
// mobile branch rather than the desktop one.
const phone = await browser.newContext({
  ...devices["iPhone 13"],
  deviceScaleFactor: 2,
});
const pp = await phone.newPage();
await pp.goto(URL, { waitUntil: "networkidle" });
await pp.evaluate(() => document.fonts.ready);
await pp.getByRole("link", { name: "signing bonus" }).tap();
await pp.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 5000 });
await pp.screenshot({ path: `${OUT}/interaction-bottom-sheet.png` });
console.log("  bottom sheet captured");
await phone.close();

await browser.close();
