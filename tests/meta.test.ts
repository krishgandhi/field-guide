import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { readMeta, stamp } from "../scripts/lib/meta.mjs";
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

it("the slate's fetchedAt comes from meta.json, so the stale warning has a time to read", () => {
  expect(SLATE.fetchedAt).toBe(lastRun("slate"));
  expect(Number.isNaN(Date.parse(SLATE.fetchedAt))).toBe(false);
});
