/**
 * The team registry, for scripts.
 *
 * The same file the app reads (src/lib/teams/nfl-teams.json, written by
 * `npm run fetch:teams`), loaded once here instead of separately by every
 * fetcher. Scripts only ever compare against ids that came from ESPN, so they
 * need the list, not the alias handling in src/lib/teams/index.ts — that
 * exists for hand-typed ids.
 *
 * Node builtins only, so the fetchers can still run before `npm ci`.
 */

import data from "../../src/lib/teams/nfl-teams.json" with { type: "json" };

export type RegistryTeam = {
  id: string;
  espnId: string;
  slug: string;
  location: string;
  name: string;
  displayName: string;
};

export const NFL_TEAMS: RegistryTeam[] = data;

/** Every team id, e.g. "BUF". */
export const TEAM_IDS: string[] = NFL_TEAMS.map((t) => t.id);
