/**
 * Checks the move entries against the rules in CLAUDE.md that a type system
 * can't express.
 *
 * The zod schema already enforces shape — six axes or none, scores 1–5, no
 * unknown keys. What it can't check is whether the prose obeys §5's word
 * budget ("two sentences each, max") or whether the rubric is actually
 * discriminating rather than rating everything a 4.
 *
 * Deliberately reads the MDX with a hand-rolled parser and no dependencies, so
 * this runs before install and can't be broken by the app's build.
 *
 *   npm run test:moves
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = "content/moves";
const failures = [];
const notes = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

/**
 * Enough YAML for this frontmatter: nested maps, `- ` sequences, inline
 * [a, b] flow lists, and `>-` folded scalars. Not general — it exists so this
 * check has no dependencies.
 */
function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    fail(file, "no frontmatter block");
    return null;
  }
  const lines = match[1].split("\n");
  const root = {};
  // Stack of [indent, container]. A folded scalar swallows following lines.
  let fold = null;

  const parseScalar = (v) => {
    const t = v.trim();
    if (t === "") return "";
    if (t === "true") return true;
    if (t === "false") return false;
    if (/^-?\d+$/.test(t)) return Number(t);
    if (t.startsWith("[") && t.endsWith("]")) {
      return t
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    return t.replace(/^["']|["']$/g, "");
  };

  let move = null;
  // The two sequence-of-map keys inside `move`. `list` is whichever one we're
  // currently inside; `item` is the map being filled.
  let list = null;
  let item = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;

    if (fold) {
      if (indent > fold.indent) {
        fold.parts.push(line.trim());
        continue;
      }
      fold.set(fold.parts.join(" "));
      fold = null;
    }

    const trimmed = line.trim();

    if (indent === 0) {
      const [, key, value] = trimmed.match(/^([\w]+):\s*(.*)$/) ?? [];
      if (!key) continue;
      if (key === "move") {
        move = {};
        root.move = move;
        list = null;
      } else {
        root[key] = parseScalar(value);
      }
      continue;
    }

    if (!move) continue;

    // Inside move:
    if (indent === 2) {
      const [, key, value] = trimmed.match(/^([\w]+):\s*(.*)$/) ?? [];
      if (!key) continue;
      if (key === "rubric" || key === "sources") {
        list = [];
        item = null;
        move[key] = list;
      } else {
        move[key] = parseScalar(value);
      }
      continue;
    }

    if (!list) continue;

    // Inside a sequence of maps:
    if (trimmed.startsWith("- ")) {
      item = {};
      list.push(item);
      const [, key, value] = trimmed.slice(2).match(/^([\w]+):\s*(.*)$/) ?? [];
      if (key) item[key] = parseScalar(value);
      continue;
    }
    if (!item) continue;
    const [, key, value] = trimmed.match(/^([\w]+):\s*(.*)$/) ?? [];
    if (!key) continue;
    if (value.trim() === ">-" || value.trim() === ">") {
      const target = item;
      fold = { indent, parts: [], set: (v) => (target[key] = v) };
    } else {
      item[key] = parseScalar(value);
    }
  }
  if (fold) fold.set(fold.parts.join(" "));

  return { frontmatter: root, body: match[2] };
}

/** Sentence count that doesn't trip on "$67.5 million" or "No. 29". */
function sentences(text) {
  return text
    .replace(/\$?\d+(\.\d+)?/g, "N")
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

const KINDS = [
  "trade", "signing", "contract", "release", "role", "injury", "coaching",
];

const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

const files = readdirSync(DIR).filter((f) => f.endsWith(".mdx"));
if (files.length === 0) failures.push("no move files found");

const bigness = [];
const allSources = [];
const kindCounts = new Map();

for (const file of files) {
  const parsed = parseFrontmatter(readFileSync(path.join(DIR, file), "utf8"), file);
  if (!parsed) continue;
  const { frontmatter: fm, body } = parsed;

  const move = fm.move;
  if (!move) {
    fail(file, "no move: block");
    continue;
  }

  // Filename and slug have to agree, or links built from one miss the other.
  if (`${fm.slug}.mdx` !== file) {
    fail(file, `slug "${fm.slug}" doesn't match the filename`);
  }

  bigness.push([fm.slug, move.bigness]);
  kindCounts.set(move.kind, (kindCounts.get(move.kind) ?? 0) + 1);

  // The filename's date and move.date are two sources of truth that can drift.
  // The slug carries YYYY-MM and the date carries the full day, so require the
  // former to be a prefix of the latter: 2026-03-linderbaum ↔ "2026-03-12"
  // passes, while a slug saying June when the frontmatter says March fails.
  const prefix = (String(fm.slug).match(/^\d{4}(-\d{2})?/) ?? [])[0];
  if (!prefix) {
    fail(file, "filename should start with the date, e.g. 2026-06-");
  } else if (!String(move.date).startsWith(prefix)) {
    fail(file, `filename says ${prefix} but move.date is ${move.date}`);
  }

  // Every entry declares what kind of change it is; the card chip and the
  // list filter both key off it.
  if (!KINDS.includes(move.kind)) {
    fail(file, `kind "${move.kind}" is not one of ${KINDS.join(", ")}`);
  }

  // The rubric is built for things where a team chose to pay a price. It has
  // nothing to say about a coach being fired or a knee giving way, and those
  // two are allowed to score nothing — but a trade with no rubric is just an
  // unfinished entry.
  const rubricOptional = ["coaching", "injury"].includes(move.kind);
  if (!rubricOptional && (move.rubric ?? []).length === 0) {
    fail(file, `kind "${move.kind}" must score the six axes`);
  }

  // Profile cards key off these. Malformed ids fail silently as a missing
  // card, so catch them here instead.
  for (const id of move.people ?? []) {
    if (!/^\d+$/.test(String(id))) {
      fail(file, `people id "${id}" is not an ESPN athlete id`);
    }
  }
  // Coaching changes have no player data to fetch, by design. Everything else
  // is about someone, and an entry with nobody named renders no card.
  if (move.kind !== "coaching" && (move.people ?? []).length === 0) {
    fail(file, `kind "${move.kind}" names nobody — add people: [espnId]`);
  }

  // §9: always link to the source.
  const sources = move.sources ?? [];
  for (const src of sources) {
    if (!src.label) fail(file, "a source has no label");
    if (!/^https:\/\/\S+\.\S+/.test(String(src.url ?? ""))) {
      fail(file, `source url isn't a well-formed https link: ${src.url}`);
    }
    allSources.push([file, src.label, src.url]);
  }
  if (move.verified === true && sources.length === 0) {
    fail(file, "verified: true but no sources — §9 requires linking out");
  }

  // §5: a move's summary is the one-line "why care".
  if (sentences(String(fm.summary)) > 1) {
    fail(file, `summary is ${sentences(String(fm.summary))} sentences, should be one`);
  }

  const axes = move.rubric ?? [];
  if (axes.length !== 0 && axes.length !== 6) {
    fail(file, `${axes.length} rubric axes — must be all six or none`);
  }

  if (axes.length === 6) {
    // §7 lists the axes in a specific order and the page renders them in file
    // order, so a shuffled file would silently reorder the reasoning.
    const got = axes.map((a) => a.axis);
    if (got.join("|") !== AXES.join("|")) {
      fail(file, `axes out of §7 order:\n    ${got.join(", ")}`);
    }
    for (const a of axes) {
      if (!(a.score >= 1 && a.score <= 5)) {
        fail(file, `${a.axis}: score ${a.score} outside 1–5`);
      }
      const n = sentences(String(a.note ?? ""));
      // §5: "Two sentences each, max."
      if (n > 2) fail(file, `${a.axis}: ${n} sentences, §5 allows two`);
      if (n === 0) fail(file, `${a.axis}: empty note`);
    }
    // A rubric where everything scores the same isn't reasoning, it's a mood.
    const spread = Math.max(...axes.map((a) => a.score)) - Math.min(...axes.map((a) => a.score));
    if (spread === 0) fail(file, "all six axes scored identically");
  }

  if (!body.trim()) fail(file, "empty body — the 'so what' is missing");
}

// §7's whole point is that positional value discriminates. If every move lands
// on the same bigness the rubric isn't doing any work.
const values = new Set(bigness.map(([, b]) => b));
if (values.size < 3) {
  failures.push(
    `bigness only takes ${values.size} distinct values across ${bigness.length} moves — the rubric isn't discriminating`,
  );
}

const linderbaum = bigness.find(([s]) => s.includes("linderbaum"));
const garrett = bigness.find(([s]) => s.includes("garrett"));
if (linderbaum && garrett && linderbaum[1] >= garrett[1]) {
  failures.push(
    `record contract for an interior lineman (${linderbaum[1]}) scores at or above the Garrett trade (${garrett[1]}) — §7 says positional value should sink it`,
  );
}

notes.push(`  kinds: ${[...kindCounts].map(([k, n]) => `${k} ${n}`).join(", ")}`);
notes.push(
  `  ${files.length} moves, bigness ${bigness
    .sort((a, b) => b[1] - a[1])
    .map(([, b]) => `${b}`)
    .join(" ")}`,
);

notes.push(`  ${allSources.length} source links`);

// Opt-in: the normal run stays offline and fast. A source that 404s is real
// rot, but not something to discover on every build.
if (process.argv.includes("--links")) {
  console.log("\n  checking source links…");
  for (const [file, label, url] of allSources) {
    let status = 0;
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (field-guide link check)" },
        signal: AbortSignal.timeout(15000),
      });
      status = res.status;
    } catch {
      status = 0;
    }
    const ok = status >= 200 && status < 400;
    console.log(`    ${ok ? "ok " : "DEAD"} ${status || "err"}  ${label}`);
    if (!ok) fail(file, `source link is dead (${status || "no response"}): ${url}`);
  }
}

console.log(notes.join("\n"));
if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nAll move checks passed.");
