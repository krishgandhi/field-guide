# Field Guide — project spec

*(Working name. Rename the repo if something better lands — the double meaning of "field guide to a foreign culture" and "football field" is the intent.)*

---

## 1. What this is

A personal reference site that explains the NFL to someone who watches games but doesn't yet have the context to follow the conversation around them.

The owner (Krish, Bills fan, based in Brooklyn) has watched football for a few years. He can follow a game. What he can't do is answer: *why does this game matter, why was that trade a big deal, what is that position actually for, who should I be paying attention to.* The goal is to close that gap well enough to hold his own in conversation with lifelong fans.

**This is a translation layer, not a stats site.** ESPN already has the data and it's useless to a newcomer because it assumes fluency. Every feature here must answer "why should I care" — not "what happened."

Success test for any piece of content: *does reading this let him say something a lifelong fan would find reasonable?*

## 2. Non-goals

Do not build these. If they seem obviously useful, they are out of scope on purpose:

- **Live scores or in-game updates.** He can use the NFL app. This site is for context, not play-by-play.
- **A fantasy football platform.** Fantasy relevance appears only as a one-line tag on players. Nothing more.
- **College football**, until Phase 5. It's a separate data domain with 130+ teams and it will double scope before anything ships.
- **Accounts, auth, or multi-user anything.** Single user. No login, ever.
- **Comprehensive stat tables.** If a number doesn't come with an explanation of why it matters, leave it out.
- **A native mobile app.** PWA only.

## 3. How to work with the owner

He describes himself as a beginner "vibecoder" — comfortable with Cursor, Claude Code, Vercel, and git; not yet comfortable debugging things he didn't understand when they were written. Work accordingly:

- **Prefer boring and obvious over clever.** If there's a clean way and a clever way, take the clean way and say why.
- **Explain architectural choices in one or two sentences before making them**, not after. Especially anything that touches data flow.
- **Small commits with real messages.** One logical change each. He should be able to read `git log` and understand the history of the project.
- **Never silently refactor.** If existing code needs restructuring, say what and why, then wait.
- **When something breaks, explain the diagnosis, not just the fix.** The debugging skill is part of the point.
- **Verify before asserting.** If you're unsure whether an API endpoint, package version, or NFL fact is current, check it. Never fill a gap with a plausible guess — the entire product is about not being confidently wrong.

## 4. Stack

Pinned. Don't substitute without discussing.

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | Vercel-native, he's used it |
| Styling | Tailwind | Fast, no separate CSS files to lose track of |
| Content | MDX files in the repo | Versioned in git, no DB, readable as plain text |
| Data store (Phase 0–2) | JSON files in the repo | Simplest possible thing that works |
| Data store (Phase 3+) | Vercel KV or Postgres — decide when it hurts | Don't pre-optimize |
| Scheduled jobs | Vercel Cron | Built in, free tier is enough |
| Mobile | PWA (manifest + service worker) | Installs to home screen, no app store |
| LLM | Anthropic API, server-side only | Never expose the key client-side |

**Critical data-flow rule:** pages never fetch from third-party APIs at request time. A cron job pulls data, generates any explanatory prose, and writes the result to storage. Pages read only from storage.

Two reasons: pages load instantly, and when a third-party endpoint breaks (it will — several are undocumented), the site shows slightly stale content instead of an error.

## 5. Content model

```
content/
  teams/          32 files    — buffalo-bills.mdx
  positions/      ~25 files   — edge-rusher.mdx
  glossary/       ~50 files   — dead-money.mdx
  moves/          growing     — 2026-06-garrett-to-rams.mdx
  calendar/       ~12 files   — franchise-tag-deadline.mdx
  rivalries/      ~10 files   — bills-chiefs.mdx
```

Frontmatter schema, every file:

```yaml
---
title: Dead money
slug: dead-money
type: glossary
aliases: [dead cap, dead cap hit]   # additional strings that trigger auto-linking
summary: One sentence. Shown in the hover/tap card.
reviewed: false                      # true once Krish has read it
flaggedTerms: []                     # jargon he flagged inside this entry
lastUpdated: 2026-07-29
---
```

`reviewed: false` renders a small marker in development only — never in production. It's a to-do list, not a disclaimer to the reader.

### Word budgets

Respect these. Over-writing is the main failure mode for this kind of site.

- Glossary entry: 40–80 words. One concrete example, ideally Bills-related.
- Position: 150–250 words. What the job is, what makes someone good at it, who's currently the best, what a broadcast says about it.
- Team: ~60 words. Are they good, who's the QB, what's their identity, one thing a fan would mention.
- Move: 6 short sections, one per rubric axis (§7). Two sentences each, max.

## 6. The two core mechanics

These are the features that make this site different from a wiki. Build them properly.

### 6a. Glossary auto-linking

Any glossary term (or alias) appearing in any content file, anywhere on the site, is automatically rendered as a tappable link. Write "dead money" once in the glossary and every future mention becomes explained for free.

Implementation notes:

- Build a term index at build time from `content/glossary/*` — title plus aliases.
- Match on longest term first, so "play action pass" wins over "pass."
- Match case-insensitively, render preserving the original case.
- **Link only the first occurrence per page.** Every instance is visual noise.
- Skip matches inside headings, code, and existing links.
- Desktop: hover card. Mobile: tap opens a bottom sheet. Both show `summary` plus a link to the full entry.
- Never let a glossary entry auto-link to itself.

### 6b. The flag queue

The mechanism that makes the site improve over time. This is the highest-value feature in the project — treat it as such.

Reading any content, Krish can select a phrase he doesn't understand and flag it. Flags accumulate. When he next opens Claude Code, the queue is the work list.

- **Storage: `localStorage`.** No backend, no auth, no database. This is a single-user site and the flags only need to survive until he exports them.
- A `/queue` route lists all flags with source file and surrounding sentence.
- An **"Export queue"** button copies the whole thing to the clipboard as JSON. He pastes it into Claude Code. That's the entire sync mechanism — don't build anything more elaborate.
- Exported flags become either new glossary entries or rewrites of the entry that confused him.
- After export, mark flags as exported rather than deleting them. Keep the history.

## 7. Rubric: why a move is "big"

Encode this. It's the reasoning framework the whole transactions feature depends on, and it's what a newcomer is missing.

Score each axis 1–5 and write two sentences:

1. **Player quality.** How good is he, actually? Awards, All-Pro selections, statistical standing, career arc.
2. **Positional value.** The one most newcomers miss. Quarterback dominates everything; edge rusher, offensive tackle, and cornerback are next; running back and guard move the needle far less. The same trade for a guard is a footnote.
3. **Cost paid.** Draft picks and players surrendered. Giving up good young players *and* picks signals conviction bordering on desperation.
4. **Cap mechanics.** Usually the invisible answer to "why did this happen at all." Restructures, option bonuses, dead money, franchise tags, and accounting dates like June 1.
5. **Competitive windows.** Is this team going for it now or building for later? The same player means opposite things to each side of the trade.
6. **Narrative violation.** Did someone reverse a public position? A team contradicting itself is what makes a transaction a *story*.

### Reference implementation

Use the June 2026 Myles Garrett trade (Browns → Rams for Jared Verse, a 2027 1st, a 2028 2nd, a 2029 3rd) as the calibration example — it scores near the ceiling on all six axes and is a genuinely useful model for the format. Write that entry first, by hand, and match its shape everywhere else.

## 8. Rubric: game watchability

Phase 3. Score 1–5, always paired with a one-line reason in plain language.

Weight roughly in this order:

1. **Spread under 4 points.** The market thinks it'll be close. Single best predictor of a good watch.
2. **Playoff or division implications**, weighted heavily after Week 10.
3. **Bills game.** Always surfaces first regardless of score.
4. **Star quarterback matchup.**
5. **Standalone broadcast window** — the league schedules its best guesses in primetime.
6. **Rivalry or revenge angle.**

Reasons must be written for someone with no context. "First place in the AFC West on the line, and these two genuinely dislike each other" — not "high-leverage divisional matchup with playoff seeding ramifications."

## 9. Data sources

Phase 3 and later. **Verify each one still works before building against it** — several are undocumented and change without notice.

| Need | Candidate | Notes |
|---|---|---|
| Schedule, scores, injuries, depth charts | ESPN public endpoints (`site.api.espn.com`) | No key, undocumented, can break without warning |
| Rosters, snap counts, advanced stats | nflverse (GitHub releases, CSV/parquet) | Free, reliable, updates in season |
| Player metadata, trending players | Sleeper API | Free, no key |
| Betting spreads | The Odds API | Free tier, needs a key |
| Contracts, cap | Over The Cap | No API — likely manual entry |
| College (Phase 5) | CollegeFootballData.com | Free with key |

**Copyright rule for any news ingestion:** summarize in original words. Never reproduce article text, never store scraped article bodies, always link to the source. If a summary would need the original phrasing to work, link out instead.

## 10. Design direction

Specific and deliberate. Do not drift toward generic sports-portal aesthetics (aggressive reds, angular gradients, dark chrome) or toward the standard AI-editorial look (warm cream background, high-contrast serif, terracotta accent).

**Concept: the coach's laminated call sheet.** Dense, gridded, tabular, color-coded by urgency, annotated in grease pencil. It's a real artifact from the subject's own world, it suits information-dense reference content, and it justifies a monospace utility face for data.

**Palette** — muted, so the accents can carry meaning:

```
--turf     #1B3A2F   deep desaturated field green, primary surface
--chalk    #E6E5DF   cool paper grey, main background (NOT warm cream)
--pencil   #C8322B   grease-pencil red, flags and urgency
--royal    #00338D   Bills royal blue, allegiance accent
--amber    #E0A526   laminate highlight, "watch this"
--graphite #2A2A28   body text
```

**Type** — three roles, deliberately paired:

- **Display: Archivo Condensed.** Roster-sheet and jersey-numeral energy. Headings and team names.
- **Body: Newsreader.** This is a reading site; long explanations need a real editorial serif.
- **Data: IBM Plex Mono.** Spreads, records, snap counts, dates. Anything tabular.

**Signature element: the grease-pencil underline.** Auto-linked glossary terms get a slightly irregular hand-drawn underline stroke — the mark of a coach circling something on a sheet. The product's entire thesis is "the jargon gets explained," so the jargon marker is the thing the site should be remembered for. Spend the boldness here and keep everything else quiet.

**Quality floor, unannounced:** responsive to 380px, visible keyboard focus, `prefers-reduced-motion` respected, tap targets 44px minimum. Phone is the primary device — he will read this on transit and in bars.

**Copy voice:** plain verbs, sentence case, active voice. Name things by what he recognizes, not by how the system works. "Flag this" not "Submit annotation." Empty states are invitations, not apologies.

## 11. Build order

Each phase ships to production. Nothing sits half-finished on a branch.

**Phase 0 — Skeleton (target: one session)**
Next.js scaffold, design tokens, PWA manifest, one hardcoded page, deployed to Vercel. The point is a live URL on day one.

**Phase 1 — Evergreen content + both core mechanics**
MDX pipeline. Glossary auto-linking (§6a). Flag queue (§6b). Then the content: ~50 glossary entries, ~25 positions, 32 team blurbs, the NFL calendar.

Claude drafts, Krish reads and flags. His review pass is not fact-checking — it's marking anything that assumed knowledge he doesn't have. He is the target user and the only one who can judge whether an explanation lands.

*Ship gate: he can read the whole site on his phone and flag things.*

**Phase 2 — Moves explained**
The bigness rubric (§7) applied to the 2026 offseason. Garrett trade first as the calibration piece. Entirely static — no APIs needed, which is why it comes before the live data work.

*Ship gate: he can explain three offseason moves unprompted.*

**Phase 3 — Live data (must land before September 9)**
Cron job pulling schedule, spreads, and injuries. Watchability scoring (§8). The weekly slate page. This is the first phase with real external dependencies — build the failure handling as you go, not after.

*Ship gate: opening the site on a Sunday morning tells him what to watch and why.*

**Phase 4 — People**
Players to watch (contract years, post-injury returns, new teams, breakout candidates). The 2026 rookie class. Bills depth chart with plain-English notes.

**Phase 5 — College football**
Only after a full NFL month of real use. Revisit scope then; it may not be worth it.

## 12. Timing

- Training camps: open now (late July 2026)
- Preseason: August — good low-stakes window to use the site and generate flags
- **Regular season opens Wednesday, September 9, 2026** — Seahawks host the Patriots, a Super Bowl LX rematch
- Phases 0–2 have no schedule dependency. Phase 3 must be working before that date.

## 13. Gotchas

- **Never commit the Anthropic API key.** Server-side routes only, `.env.local`, and check `.gitignore` before the first commit.
- **Generate explanatory prose once and cache it.** Regenerating on every page load is slow and pointless — the facts haven't changed.
- **The glossary index must be built, not computed per-request.** It touches every page.
- **Bye weeks.** A team not playing is not a bug, and the UI should say so explicitly. This confuses newcomers every single year.
- **Team abbreviations are inconsistent across data sources.** `BUF` vs `Buffalo` vs `Bills` vs numeric IDs. Normalize once, in one place, the first time you touch two sources.
- **Don't let the site become a wall of unreviewed generated text.** Content with `reviewed: false` is a debt, not an asset. If the queue grows faster than he reads, slow down generation.
