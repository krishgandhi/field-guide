/**
 * Shape of the hand-written calendar, the last of the mock data.
 *
 * Teams live in src/lib/teams (the one registry) and games in
 * src/data/slate.json; the mock team list and game shape that used to sit here
 * were retired once the real data replaced them.
 */

export type CalendarItem = {
  slug: string;
  label: string;
  date: string;
  /** Why this date matters to someone who has never followed an offseason. */
  why: string;
};
