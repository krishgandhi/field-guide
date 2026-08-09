/**
 * Check §8 scoring against fixed inputs.
 *
 * Deliberately not against live ESPN data: the point is that a close divisional
 * primetime game outranks a blowout, and that must hold regardless of what this
 * week's schedule happens to look like.
 *
 * Usage: npm run test:watchability
 */

const { watchability, sortForViewing, factorsFor } = await import("../src/lib/watchability.ts");

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  " + detail : ""}`);
};

const game = (over) => ({
  id: "x",
  kickoff: "2026-09-13T17:00:00Z", // 1pm ET Sunday — not primetime
  home: "HOU",
  away: "TB",
  spread: 10,
  favourite: "home",
  overUnder: 44,
  broadcast: "CBS",
  venue: null,
  neutralSite: false,
  ...over,
});

// --- the headline claim from §8 -----------------------------------------
const tight = game({ home: "BUF", away: "MIA", spread: 2, kickoff: "2026-09-15T00:20:00Z" });
const blowout = game({ home: "HOU", away: "TB", spread: 14 });
check(
  "close divisional primetime outranks a Sunday blowout",
  watchability(tight, 1).score > watchability(blowout, 1).score,
  `${watchability(tight, 1).score} vs ${watchability(blowout, 1).score}`,
);

// --- factor 1: spread is the strongest single signal ---------------------
check(
  "a 2-point spread beats a 14-point spread, all else equal",
  watchability(game({ spread: 2 }), 1).score > watchability(game({ spread: 14 }), 1).score,
);

// --- factor 2: divisional weighs heavier late ----------------------------
const div = game({ home: "BUF", away: "NYJ", spread: 8 });
// Asserted on points, not the bucketed 1-5: the extra weight is real but can
// fail to cross a bucket boundary, and a >= on the score would pass even if
// the weighting had been dropped entirely.
const pts = (g, wk) => factorsFor(g, wk).reduce((s, f) => s + f.points, 0);
check(
  "divisional games carry more weight from week 10",
  pts(div, 12) > pts(div, 2),
  `wk2=${pts(div, 2)}pts wk12=${pts(div, 12)}pts`,
);

// --- factor 3: Bills sort first WITHOUT their score being inflated -------
const billsDull = game({ home: "BUF", away: "JAX", spread: 13 });
const otherGreat = game({ home: "KC", away: "LAR", spread: 1, kickoff: "2026-09-15T00:20:00Z" });
const ordered = sortForViewing([otherGreat, billsDull], 1);
check("Bills game sorts first", ordered[0] === billsDull);
check(
  "…but its score is not inflated",
  watchability(billsDull, 1).score < watchability(otherGreat, 1).score,
  `bills=${watchability(billsDull, 1).score} other=${watchability(otherGreat, 1).score}`,
);

// --- factor 6: rivalry is caught even when not divisional ----------------
const rivalry = game({ home: "KC", away: "BUF", spread: 9 });
const neutral = game({ home: "KC", away: "JAX", spread: 9 });
check(
  "non-divisional rivalry (Bills–Chiefs) scores above a neutral matchup",
  watchability(rivalry, 1).score > watchability(neutral, 1).score,
  `${watchability(rivalry, 1).score} vs ${watchability(neutral, 1).score}`,
);

// --- reasons are plain, present, and jargon-free -------------------------
const jargon = ["leverage", "seeding", "implications", "efficiency", "variance", "spread"];
let bad = [];
for (const g of [tight, blowout, div, rivalry, otherGreat]) {
  const { reason } = watchability(g, 1);
  if (!reason.endsWith(".")) bad.push(`no full stop: "${reason}"`);
  for (const j of jargon) if (reason.toLowerCase().includes(j)) bad.push(`jargon "${j}": "${reason}"`);
}
check("every reason is a plain sentence with no jargon", bad.length === 0, bad.join(" | "));

// --- a stored (Claude-written) reason wins over the template -------------
const withStored = game({ spread: 2, reason: "A stored sentence written by the model." });
const stored = watchability(withStored, 1);
check(
  "stored reason is used instead of the template",
  stored.reason === "A stored sentence written by the model.",
  `"${stored.reason}"`,
);
check(
  "...but the score is still computed from the factors, not the prose",
  stored.score === watchability(game({ spread: 2 }), 1).score,
  `${stored.score}`,
);

// --- a game with no posted line still scores and explains itself ---------
const noLine = game({ spread: null, favourite: null });
const nl = watchability(noLine, 1);
check("missing spread degrades gracefully", nl.score >= 1 && nl.reason.length > 0, `"${nl.reason}"`);

console.log("\nsample reasons:");
for (const [label, g] of [["tight divisional primetime", tight], ["blowout", blowout], ["Bills–Chiefs", rivalry]]) {
  const w = watchability(g, 1);
  console.log(`  ${w.score}/5  ${label}: ${w.reason}`);
}

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
