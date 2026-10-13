/**
 * Drive the whole §6b loop in a real browser: select a phrase, flag it, see it
 * in the queue, export it to the clipboard, confirm it's marked exported.
 *
 * localStorage + text selection + clipboard can't be verified by reading HTML,
 * so this is the only honest check.
 *
 * Usage: npm run build && npm start, then npm run e2e:flags
 */

import { chromium, devices } from "playwright";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  " + detail : ""}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["iPhone 13"],
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await ctx.newPage();

// --- 1. flag a phrase ----------------------------------------------------
await page.goto(`${BASE}/glossary/dead-money`, { waitUntil: "networkidle" });

// Select "unused slice" inside the first body paragraph.
await page.evaluate(() => {
  const p = [...document.querySelectorAll("article p")].find((el) =>
    el.textContent.includes("unused slice"),
  );
  const node = [...p.childNodes].find((n) => n.textContent.includes("unused slice"));
  const start = node.textContent.indexOf("unused slice");
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + "unused slice".length);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
});

const flagBtn = page.getByRole("button", { name: "Flag this" });
await flagBtn.waitFor({ state: "visible", timeout: 5000 });
check("'Flag this' appears on selection", true);

await flagBtn.click();
await page.getByRole("status").waitFor({ state: "visible", timeout: 5000 });
check("confirmation toast shown after flagging", true);

const stored = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("field-guide.flags.v1") ?? "[]"),
);
check("one flag persisted", stored.length === 1, `count=${stored.length}`);
check("phrase captured", stored[0]?.phrase === "unused slice", `"${stored[0]?.phrase}"`);
check(
  "surrounding sentence captured",
  (stored[0]?.sentence ?? "").includes("unused slice") &&
    stored[0].sentence.length > "unused slice".length,
  `"${(stored[0]?.sentence ?? "").slice(0, 60)}…"`,
);
check(
  "source file resolved",
  stored[0]?.sourceFile === "content/glossary/dead-money.mdx",
  String(stored[0]?.sourceFile),
);
check("not yet exported", stored[0]?.exportedAt === null);

// --- 2. selection outside flaggable prose is ignored ---------------------
await page.goto(`${BASE}/games`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const h = document.querySelector("h1");
  const range = document.createRange();
  range.selectNodeContents(h);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
});
await page.waitForTimeout(400);
check(
  "no flag button outside a flaggable region",
  (await page.getByRole("button", { name: "Flag this" }).count()) === 0,
);

// --- 3. queue entry point appears on This week ---------------------------
await page.goto(BASE, { waitUntil: "networkidle" });
check(
  "queue link surfaces on This week",
  await page.getByText("1 thing you flagged").isVisible(),
);

// --- 4. queue lists it, export copies JSON -------------------------------
await page.goto(`${BASE}/queue`, { waitUntil: "networkidle" });
check(
  "queue shows the phrase",
  await page.getByText("unused slice", { exact: false }).first().isVisible(),
);

await page.getByRole("button", { name: /Export queue/ }).click();
await page.waitForTimeout(600);

const clip = await page.evaluate(() => navigator.clipboard.readText());
let parsed = null;
try {
  parsed = JSON.parse(clip);
} catch {
  /* leave null */
}
check("clipboard holds valid JSON", parsed !== null);
check("payload contains the flag", parsed?.flags?.[0]?.phrase === "unused slice");
check(
  "payload names the source file",
  parsed?.flags?.[0]?.sourceFile === "content/glossary/dead-money.mdx",
);

const after = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("field-guide.flags.v1") ?? "[]"),
);
check("flag marked exported, not deleted", after.length === 1 && !!after[0].exportedAt);

// --- 5. a flag on a move page names a file that exists -------------------
// The regression this guards: Krish's first real flag came from a Moves page
// and reported content/moves/2026-06-garrett-to-rams.mdx as its source when
// move text still lived in TypeScript. A source file that doesn't exist sends
// me editing nothing, so assert the path resolves AND is really on disk.
await page.goto(`${BASE}/moves/2026-06-garrett-to-rams`, {
  waitUntil: "networkidle",
});
const flaggedOnMove = await page.evaluate(() => {
  const el = [...document.querySelectorAll("p")].find((p) =>
    p.textContent.includes("prime"),
  );
  if (!el) return false;
  const node = [...el.childNodes].find((n) => n.textContent.includes("prime"));
  const start = node.textContent.indexOf("prime");
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + "prime".length);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
  return true;
});
check("found prose to flag on the move page", flaggedOnMove);

const moveFlagBtn = page.getByRole("button", { name: "Flag this" });
await moveFlagBtn.waitFor({ state: "visible", timeout: 5000 });
await moveFlagBtn.click();
await page.waitForTimeout(300);

const moveFlag = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("field-guide.flags.v1") ?? "[]").find((f) =>
    f.path.startsWith("/moves/"),
  ),
);
check(
  "move flag names its content file",
  moveFlag?.sourceFile === "content/moves/2026-06-garrett-to-rams.mdx",
  String(moveFlag?.sourceFile),
);
check(
  "and that file is really on disk",
  moveFlag?.sourceFile ? existsSync(moveFlag.sourceFile) : false,
);

await page.goto(`${BASE}/queue`, { waitUntil: "networkidle" });
await page.screenshot({ path: ".screenshots/interaction-queue.png" });
await browser.close();

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
