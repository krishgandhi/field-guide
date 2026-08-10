/**
 * Shapes for the mock companion data.
 *
 * These are written as the shapes the *real* data will take, so Phase 3's cron
 * job can replace the mock modules without any screen changing. Everything a
 * screen renders comes from here.
 *
 * Rule for this whole directory: a score never travels without the sentence
 * that explains it. CLAUDE.md §8 — "always paired with a one-line reason in
 * plain language" — and more generally §1, a number with no explanation is the
 * thing this product exists to replace.
 */

export type TeamId =
  | "BUF" | "MIA" | "NE" | "NYJ"
  | "BAL" | "CIN" | "CLE" | "PIT"
  | "HOU" | "IND" | "JAX" | "TEN"
  | "DEN" | "KC" | "LV" | "LAC"
  | "DAL" | "NYG" | "PHI" | "WAS"
  | "CHI" | "DET" | "GB" | "MIN"
  | "ATL" | "CAR" | "NO" | "TB"
  | "ARI" | "LAR" | "SF" | "SEA";

export type Team = {
  id: TeamId;
  slug: string;
  city: string;
  name: string;
  conference: "AFC" | "NFC";
  division: "East" | "North" | "South" | "West";
  // Write-ups are not fields here — they're content/teams/*.mdx (§5), read
  // through getEntry("teams", slug) so §6a auto-linking applies to them.
};

export type Game = {
  id: string;
  week: number;
  kickoff: string;
  away: TeamId;
  home: TeamId;
  /** Negative favours the home team, e.g. -2.5 = home favoured by 2.5. */
  spread: number | null;
  /** National window (SNF/MNF/TNF/Thanksgiving) or null for the Sunday pile. */
  window: string | null;
  /** §8, 1–5. */
  watchability: number;
  /** §8: written for someone with no context. Never jargon. */
  reason: string;
};

export type CalendarItem = {
  slug: string;
  label: string;
  date: string;
  /** Why this date matters to someone who has never followed an offseason. */
  why: string;
};
