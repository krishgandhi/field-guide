import type { CalendarItem } from "./types";

/**
 * All that survives of the mock slate.
 *
 * Games, spreads, byes and watchability are now real, fetched from ESPN into
 * src/data/slate.json. The calendar is still hand-written: there is no feed for
 * "why this date matters to someone who has never followed an offseason".
 */

export const CALENDAR: CalendarItem[] = [
  {
    slug: "season-opener",
    label: "Season opens",
    date: "Wed 9 Sep",
    why: "First real game after seven months of nothing. Everything before this is practice.",
  },
  {
    slug: "bills-bye",
    label: "Bills bye week",
    date: "Week 7",
    why: "Buffalo don't play at all that week. Nothing is wrong — they're resting.",
  },
];
