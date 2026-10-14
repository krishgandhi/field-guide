/**
 * Drive the Moves sort and filter controls in a real browser.
 *
 * Client state, a native <select> and a re-sorted list can't be verified by
 * reading the built HTML — the server renders one order and the browser may
 * show another. This is the only honest check.
 *
 * Usage: npm run build && npm start, then npm run e2e:filters
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

// Counts are derived, never hardcoded: entries auto-publish daily now, so a
// literal "8" would break this test every time the pipeline finds something.
const TOTAL = (await headlines()).length;

// --- default: newest first -------------------------------------------------
const initial = await headlines();
check("the list renders", TOTAL > 0, `${TOTAL} entries`);
check(
  "Newest is the default sort",
  (await page.getByRole("button", { name: "Newest" }).getAttribute("aria-pressed")) ===
    "true",
);
// Assert the ORDER rather than which entry happens to be newest today.
const dateText = () =>
  page.locator("a[href^='/moves/'] [data-move-date]").allTextContents();
const asDate = (t) => new Date(t.trim()).getTime();
const initialDates = (await dateText()).map(asDate);
check(
  "Newest sorts strictly newest-first",
  initialDates.every((d, i) => i === 0 || initialDates[i - 1] >= d),
  initialDates.map((d) => new Date(d).toISOString().slice(0, 10)).join(" "),
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
  (await page.getByText(new RegExp(`^${bills.length} of ${TOTAL}$`, "i")).count()) === 1,
  `${bills.length} of ${TOTAL}`,
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
check("clearing filters restores everything", (await count()) === TOTAL);

// --- size filter on its own ------------------------------------------------
await page.getByLabel("Filter by how big").selectOption({ label: "Minor" });
await page.waitForTimeout(200);
const minor = await headlines();
check("Minor narrows the list", minor.length > 0 && minor.length < TOTAL, `got ${minor.length}`);
check(
  "and every card shown reads Minor",
  // The chip reads "Minor · 2" (src/lib/moves/bigness.ts).
  (await page.locator('a[href^="/moves/"]').getByText(/^Minor · \d$/).count()) ===
    minor.length,
  minor.join(" / "),
);

// --- type filter -----------------------------------------------------------
await page.getByLabel("Filter by how big").selectOption({ label: "Any size" });
await page.getByLabel("Filter by type").selectOption({ label: "Trade" });
await page.waitForTimeout(200);
const trades = await headlines();
check("Trade filter narrows the list", trades.length > 0 && trades.length < TOTAL, `got ${trades.length}`);
check(
  "and every card shown reads Trade",
  (await page.locator('a[href^="/moves/"]').getByText("Trade", { exact: true }).count()) ===
    trades.length,
  trades.join(" / "),
);

await page.getByLabel("Filter by type").selectOption({ label: "Role change" });
await page.waitForTimeout(200);
const roles = await headlines();
check("Role change finds the Murray entry", roles.some((h) => /Murray/.test(h)), roles.join(" / "));

// The type picker must not offer a kind nothing uses.
//
// This named Injury and Release as the forbidden pair, which was true the day
// it was written and stopped being true the moment the pipeline published a
// release — the picker correctly grew a Release option and the test called it
// a bug. Same trap as TOTAL above: derive it. Select each option and require
// at least one card behind it.
const kindOptions = (
  await page.getByLabel("Filter by type").locator("option").allTextContents()
).filter((label) => label !== "All types");

const emptyKinds = [];
for (const label of kindOptions) {
  await page.getByLabel("Filter by type").selectOption({ label });
  await page.waitForTimeout(200);
  if ((await count()) === 0) emptyKinds.push(label);
}
check(
  "picker offers no empty categories",
  emptyKinds.length === 0,
  emptyKinds.length ? `empty: ${emptyKinds.join(", ")}` : kindOptions.join(", "),
);

await page.getByLabel("Filter by type").selectOption({ label: "All types" });
await page.waitForTimeout(200);

// --- dates render at one precision -----------------------------------------
const dates = await page
  .locator("a[href^='/moves/'] [data-move-date]")
  .allTextContents();
check("every card shows a full day-month-year", dates.length === TOTAL, `got ${dates.length}`);
const badDate = dates.find((d) => !/^\d{1,2}\s+\w+\s+\d{4}$/.test(d.trim()));
check("no partial dates left", !badDate, badDate ?? "");

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
