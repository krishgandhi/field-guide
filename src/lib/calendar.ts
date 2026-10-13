import { getAllEntries } from "@/lib/content";

/**
 * Dates worth knowing, read from content/calendar/*.mdx (§5).
 *
 * These were a hand-written array in src/lib/mock/games.ts, and the home
 * screen always showed the first one — "Season opens, Wed 9 Sep" was still
 * "coming up" in October. Now each entry carries a real date and the home
 * screen asks for the next one.
 */

export type CalendarItem = {
  slug: string;
  label: string;
  /** YYYY-MM-DD, or null for an item built from live data (a bye). */
  date: string | null;
  /** "Tue 10 Nov", or "Week 7" for a bye. */
  dateLabel: string;
  /** Why this date matters to someone who has never followed a season. */
  why: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-11-10" → "Tue 10 Nov". Spelled out by hand rather than with Intl,
 * whose short month varies by ICU version ("Sep" vs "Sept"). Read as UTC
 * midnight so the day never shifts.
 */
export function formatCalendarDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Every calendar entry, soonest first. */
export function getCalendar(): CalendarItem[] {
  return getAllEntries("calendar")
    .flatMap((fm) =>
      fm.calendar
        ? [
            {
              slug: fm.slug,
              label: fm.title,
              date: fm.calendar.date,
              dateLabel: formatCalendarDate(fm.calendar.date),
              why: fm.summary,
            },
          ]
        : [],
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Today's date in New York as YYYY-MM-DD — the league's clock. */
export function todayInNewYork(now: number = Date.now()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date(now),
  );
}

/**
 * The one date the home screen shows.
 *
 * A Bills bye this week comes first, because "where are the Bills?" is the
 * question that week. It is read from the slate's bye list — the week's real
 * schedule — not typed in: the old hard-coded "Week 7" would have been wrong
 * the moment the schedule moved, and wrong every season after.
 *
 * Otherwise the soonest entry dated today or later. Null when nothing is left,
 * so the page drops the section rather than showing a date that has passed.
 */
export function comingUp(
  {
    now = Date.now(),
    items = getCalendar(),
    byes = [],
    week,
    favourite = "BUF",
  }: {
    now?: number;
    items?: CalendarItem[];
    byes?: string[];
    week: number;
    favourite?: string;
  },
): CalendarItem | null {
  if (byes.includes(favourite)) {
    return {
      slug: "bills-bye",
      label: "Bills bye week",
      date: null,
      dateLabel: `Week ${week}`,
      why: "Buffalo don't play at all this week. Nothing is wrong — they're resting.",
    };
  }
  const today = todayInNewYork(now);
  return items.find((item) => item.date !== null && item.date >= today) ?? null;
}
