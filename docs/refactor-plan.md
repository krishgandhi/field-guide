# Refactor plan — October 2026

Branch: `refactor/app-overhaul`. One PR, many small commits, each one logical change.
CLAUDE.md stays the spec; this plan changes *how* it's built, not *what* the site is.

## What the audit found

**Backend**
- Every Claude-written feature has been failing with `401 invalid x-api-key` since Sep 12.
  `continue-on-error` keeps the Actions runs green, so nobody noticed.
- With a working key it would make ~45 Opus calls/week, most redundant:
  - `fetch-slate` wipes `game.reason`, so every game reason regenerates daily.
  - Unit-note and profile cache keys include raw stats, so every game day rewrites all 96 notes.
  - Moves drafting sends 40 candidates in one 16k-token call with no truncation check, so it
    would fail and retry daily.
- Every run commits (timestamps change), so each day produces 1–2 production builds whether or not
  anything changed.
- An unquoted generated title can break YAML and take the whole Vercel build down.
- Hardcoded: `SEASON`, `WEEK_ONE_START`, week clamped at 18 (no playoffs), Bills bye "Week 7",
  a 3-team star-QB list, two competing team registries (`WAS` vs `WSH`).
- Helpers copied 3–4× (ESPN fetch, Anthropic setup, frontmatter regexes).
- No test runner and no CI gate before pushing to main.

**Frontend**
- Wrong on screen:
  - "Made the playoffs" mid-season.
  - "Coming up: Season opens 9 Sep" on Oct 12.
  - "Biggest recent move" is permanently June's Garrett trade.
  - Verified moves still labelled "Sample data".
  - The stale-data banner can never fire because it's computed at build time.
- No service worker; the manifest and icons still use the dead light palette.
- Flag queue:
  - Export re-sends already-exported flags.
  - Source file is wrong for JSON-backed prose.
  - The button strands on scroll.
- Auto-linking only covers MDX bodies (not summaries, unit notes or game reasons), and it misses plurals.
- Visual: competent, but samey cards, repeated arbitrary-value classes, and cryptic `fav` / `1 out` labels.

## Phases (each = a handful of commits, each verified before the next)

1. **Tooling floor.** vitest replaces the home-made `check()` runners. A CI workflow runs lint,
   typecheck, tests and build on every PR and before any bot commit.
2. **Shared modules.**
   - `scripts/lib/espn` (timeouts, retries, `seasontype=2`, current season/week read from ESPN's
     calendar, including playoffs).
   - `scripts/lib/claude` (one model id, structured output, `max_tokens` and refusal handling,
     token logging).
   - One team registry.
   - Frontmatter parsing via gray-matter.
3. **Stop burning calls.**
   - A prose cache keyed on a hash of the *coarse* inputs (spread bucket, rank tiers, article ids),
     stored apart from fetched data, so unchanged inputs never re-call.
   - Old prose is replaced only after the new prose validates.
   - Moves drafted in batches of 6 with a retry cap.
4. **Safe publishing.**
   - Generated moves are serialized with a YAML library and validated through gray-matter plus the
     app's zod schema before they land.
   - Timestamps move to `src/data/meta.json`; commit only when content changed.
   - One ordered workflow (fetch → write → validate → build → commit).
   - A 401 fails the job loudly.
5. **Correctness fixes.**
   - Playoff wording; calendar filtered by date and byes read from data.
   - "Recent move" sorted by date; correct badges; stale banner computed client-side.
   - Watchability statements made true (division games and tiebreakers, standings-aware playoff
     claims, primetime detection).
6. **UI overhaul — new direction** (Impeccable + 21st.dev). Owner decision: replace §10's
   Apple Sports direction with something closer to **Sleeper**, and more football themed.
   A design proposal comes back for approval before any UI code; CLAUDE.md §10 is rewritten
   to match once approved.
   - Home, games, team, move, glossary and queue redesigned with real hierarchy.
   - Shared type and label utilities; jargon labels replaced.
   - Glossary sheet: animated, focus-trapped, scroll-locked.
   - Auto-linking extended to all rendered prose, with plurals.
   - 44px tap targets.
7. **Flag queue fixes.**
   - Export only pending flags.
   - Correct source attribution for JSON prose.
   - The button tracks scroll and works with iOS touch.
   - Flaggable everywhere; `/queue` gets a title.
8. **PWA.** Service worker (offline shell + last-read pages), dark manifest and icons.
9. **Harness loop.**
   - Build, tests and Playwright screenshots at 380px and desktop on every route.
   - A reviewer agent checks against this plan and §10; a fixer agent addresses findings.
   - Repeat until clean.

## Decisions (2026-10-12)
- All nine phases approved.
- Model: `claude-sonnet-5-5` for short prose (game reasons, unit notes, profile lines);
  `claude-opus-5-5` only for move rubric drafts.
- UI: new direction (Sleeper-like, football themed), proposal first.

## Out of scope for this PR
- Writing new content (the remaining glossary entries, positions, calendar, rivalries).
  Krish reviews content; we don't bulk-generate it here.
- Changing the storage model (JSON in repo stays, per §4).
- Fixing the Anthropic key: Krish has to rotate the `ANTHROPIC_API_KEY` repo secret himself.
