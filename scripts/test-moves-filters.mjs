/**
 * Drive the Moves sort and filter controls in a real browser.
 *
 * Client state, a native <select> and a re-sorted list can't be verified by
 * reading the built HTML — the server renders one order and the browser may
 * show another. This is the only honest check.
 *
 * Usage: npm run build && npm start, then npm run test:filters
 */

import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  " + detail : ""}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext(devices["iPhone 13"]);
const page = await ctx.newPage();
await page.goto(`${BASE}/moves`, { waitUntil: "networkidle" });

const CARD = 'a[href^="/moves/"] h2';
const headlines = () => page.locator(CARD).allTextContents();
const count = () => page.locator(CARD).count();

// --- default: newest first -------------------------------------------------
const initial = await headlines();
check("all seven show by default", initial.length === 7, `got ${initial.length}`);
check(
  "Newest is the default sort",
  (await page.getByRole("button", { name: "Newest" }).getAttribute("aria-pressed")) ===
    "true",
);
check(
  "newest entry is a June move",
  /Garrett|Brown/.test(initial[0] ?? ""),
  initial[0],
);
check(
  "oldest entry is last",
  /McDermott/.test(initial.at(-1) ?? ""),
  initial.at(-1),
);

// --- switching to Biggest reorders ----------------------------------------
await page.getByRole("button", { name: "Biggest" }).click();
await page.waitForTimeout(200);
const biggest = await headlines();
check("Biggest puts the 5 first", /Garrett/.test(biggest[0] ?? ""), biggest[0]);
check(
  "Biggest puts a Minor last",
  /Linderbaum|Allen/.test(biggest.at(-1) ?? ""),
  biggest.at(-1),
);
check("sort changed the order", initial.join("|") !== biggest.join("|"));

await page.getByRole("button", { name: "Newest" }).click();
await page.waitForTimeout(200);

// --- team filter -----------------------------------------------------------
await page.getByLabel("Filter by team").selectOption({ label: "Bills" });
await page.waitForTimeout(200);
const bills = await headlines();
check("Bills filter narrows the list", bills.length === 2, `got ${bills.length}`);
check(
  "and shows only Bills moves",
  bills.every((h) => /Bills/.test(h)),
  bills.join(" / "),
);
check(
  "counter reflects the filter",
  (await page.getByText(/^2 of 7$/i).count()) === 1,
);

// --- combining filters to an empty result ---------------------------------
await page.getByLabel("Filter by how big").selectOption({ label: "Huge" });
await page.waitForTimeout(200);
check("Bills + Huge matches nothing", (await count()) === 0);
const empty = await page.getByText(/Nothing matches that combination/).isVisible();
check("empty state is shown", empty);

// --- resetting brings everything back --------------------------------------
await page.getByLabel("Filter by team").selectOption({ label: "All teams" });
await page.getByLabel("Filter by how big").selectOption({ label: "Any size" });
await page.waitForTimeout(200);
check("clearing filters restores all seven", (await count()) === 7);

// --- size filter on its own ------------------------------------------------
await page.getByLabel("Filter by how big").selectOption({ label: "Minor" });
await page.waitForTimeout(200);
const minor = await headlines();
check("Minor shows the two low-scored moves", minor.length === 2, `got ${minor.length}`);
check(
  "and they are the ones expected",
  minor.every((h) => /Linderbaum|Allen/.test(h)),
  minor.join(" / "),
);

// --- quality floor ---------------------------------------------------------
await page.getByLabel("Filter by how big").selectOption({ label: "Any size" });
const box = await page.getByRole("button", { name: "Newest" }).boundingBox();
check("sort control meets the 44px tap target", (box?.height ?? 0) >= 44, `${box?.height}px`);
const selectBox = await page.getByLabel("Filter by team").boundingBox();
check("team picker meets the 44px tap target", (selectBox?.height ?? 0) >= 44, `${selectBox?.height}px`);

const scrolls = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
);
check("no horizontal scroll at phone width", !scrolls);

await browser.close();
console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
