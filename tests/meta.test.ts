import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { freshRun, readMeta, stamp } from "../scripts/lib/meta.mjs";
import { SLATE } from "@/lib/slate";
import { lastRun } from "@/lib/meta";

it("stamp records one key without disturbing the others", () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "meta-")), "meta.json");
  stamp("slate", new Date("2026-10-01T00:00:00Z"), file);
  stamp("people", new Date("2026-10-02T00:00:00Z"), file);
  expect(readMeta(file)).toEqual({
    people: "2026-10-02T00:00:00.000Z",
    slate: "2026-10-01T00:00:00.000Z",
  });
  expect(readFileSync(file, "utf8").endsWith("}\n")).toBe(true);
});

it("only a run that refreshed everything itself may stamp", () => {
  expect(freshRun({ expected: 32, written: 32, carriedOver: 0 })).toBe(true);
  // All 32 present, but every one kept from yesterday during an ESPN outage.
  expect(freshRun({ expected: 32, written: 32, carriedOver: 32 })).toBe(false);
  expect(freshRun({ expected: 32, written: 32, carriedOver: 1 })).toBe(false);
  expect(freshRun({ expected: 32, written: 31, carriedOver: 0 })).toBe(false);
});

it("the slate's fetchedAt comes from meta.json, so the stale warning has a time to read", () => {
  expect(SLATE.fetchedAt).toBe(lastRun("slate"));
  expect(Number.isNaN(Date.parse(SLATE.fetchedAt))).toBe(false);
});
