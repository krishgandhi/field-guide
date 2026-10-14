/**
 * Team colours are decoration, but they still have to be legible (§10): every
 * displayColor clears 4.5:1 on the page ground AND on a card, which is a step
 * lighter and the harder of the two.
 */

import { describe, expect, it } from "vitest";
import { BACKGROUNDS, contrast, toDisplayColor, worstContrast } from "../scripts/lib/display-color.mjs";
import { NFL_TEAMS } from "@/lib/teams";
import { readFileSync } from "node:fs";

describe("team display colours", () => {
  it("uses the same night and surface as globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    expect(css).toContain(`--color-night: ${BACKGROUNDS.night.toLowerCase()}`);
    expect(css).toContain(`--color-surface: ${BACKGROUNDS.surface.toLowerCase()}`);
  });

  it("every committed displayColor clears 4.5:1 on night and on surface", () => {
    const failing = NFL_TEAMS.filter(
      (t) =>
        contrast(t.displayColor, BACKGROUNDS.night) < 4.5 ||
        contrast(t.displayColor, BACKGROUNDS.surface) < 4.5,
    ).map((t) => `${t.id} ${t.displayColor}`);
    expect(failing).toEqual([]);
  });

  it("lifts Buffalo's navy until it is readable, keeping the hue blue", () => {
    const lifted = toDisplayColor("#00338D", null);
    expect(worstContrast(lifted)).toBeGreaterThanOrEqual(4.5);
    const [r, , b] = [1, 3, 5].map((i) => parseInt(lifted.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
  });

  it("falls back to the alternate colour when the primary is black", () => {
    expect(toDisplayColor("#000000", "#FFB612")).toBe("#FFB612");
  });
});
