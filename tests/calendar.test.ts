/**
 * "Coming up" follows the date. It used to show the first hand-written item
 * forever, so "Season opens, Wed 9 Sep" was still coming up in October.
 */

import { describe, expect, it } from "vitest";
import { comingUp, formatCalendarDate, getCalendar, todayInNewYork } from "@/lib/calendar";

const item = (slug: string, date: string) => ({
  slug,
  label: slug,
  date,
  dateLabel: formatCalendarDate(date),
  why: "",
});
const items = [item("opener", "2026-09-09"), item("deadline", "2026-11-10"), item("sb", "2027-02-14")];
const at = (iso: string) => Date.parse(iso);

describe("comingUp", () => {
  it("skips dates that have passed", () => {
    expect(comingUp({ now: at("2026-10-13T12:00:00Z"), items, week: 6 })?.slug).toBe("deadline");
  });

  it("still shows a date on the day itself, by New York's clock", () => {
    // 11pm in New York on 10 Nov is already the 11th in UTC.
    expect(comingUp({ now: at("2026-11-11T04:00:00Z"), items, week: 10 })?.slug).toBe("deadline");
  });

  it("returns null once everything has passed", () => {
    expect(comingUp({ now: at("2027-03-01T12:00:00Z"), items, week: 18 })).toBeNull();
  });

  it("leads with a Bills bye when the slate says they're off", () => {
    const bye = comingUp({ now: at("2026-10-27T12:00:00Z"), items, byes: ["KC", "BUF"], week: 7 });
    expect(bye?.label).toBe("Bills bye week");
    expect(bye?.dateLabel).toBe("Week 7");
  });

  it("says nothing about a bye in a week the Bills play", () => {
    expect(comingUp({ now: at("2026-10-13T12:00:00Z"), items, byes: ["KC"], week: 5 })?.label).not.toMatch(/bye/i);
  });
});

describe("calendar content", () => {
  it("formats dates without shifting the day", () => {
    expect(formatCalendarDate("2026-09-09")).toBe("Wed 9 Sep");
    expect(formatCalendarDate("2026-11-10")).toBe("Tue 10 Nov");
  });

  it("reads every entry from content/calendar, soonest first", () => {
    const all = getCalendar();
    expect(all.length).toBeGreaterThan(0);
    expect(all.map((i) => i.date)).toEqual(all.map((i) => i.date).sort());
  });

  it("knows today in New York", () => {
    expect(todayInNewYork(at("2026-10-13T03:00:00Z"))).toBe("2026-10-12");
  });
});
