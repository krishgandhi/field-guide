/**
 * Spelled-out figures. The profile brief asks for them, and numbersIn only
 * sees digits, so without this every spelled-out figure went unchecked.
 */

import { describe, expect, it } from "vitest";
import { approximations, spelledToDigits } from "../scripts/lib/number-words.mjs";

describe("spelledToDigits", () => {
  it.each([
    ["nearly eighty career rushing touchdowns", "nearly 80 career rushing touchdowns"],
    ["still only twenty-five", "still only 25"],
    ["still only twenty five", "still only 25"],
    ["nearly ninety starts", "nearly 90 starts"],
    ["more than four thousand yards", "more than 4000 yards"],
    ["more than a hundred and twenty-five sacks", "more than 125 sacks"],
    ["a dozen sacks", "12 sacks"],
    ["better than nine in ten field goals", "better than 9 in 10 field goals"],
    ["two and three", "2 and 3"],
  ])("%s", (input, output) => {
    expect(spelledToDigits(input)).toBe(output);
  });

  it("keeps the money scale as a word, the way sourced text writes it", () => {
    expect(spelledToDigits("a hundred and thirty million dollars")).toBe("130 million dollars");
  });

  it("leaves a lone 'one', which is nearly always a pronoun", () => {
    expect(spelledToDigits("one of the best quarterbacks")).toBe("one of the best quarterbacks");
    expect(spelledToDigits("a one-year deal")).toBe("a one-year deal");
    expect(spelledToDigits("twenty-one starts")).toBe("21 starts");
  });

  it("leaves ordinals whole, including compounds", () => {
    expect(spelledToDigits("drafted twenty-fifth overall in his ninth season")).toBe(
      "drafted twenty-fifth overall in his ninth season",
    );
  });

  it("does not touch words that merely contain a number", () => {
    expect(spelledToDigits("someone often tends to weigh in")).toBe("someone often tends to weigh in");
  });
});

describe("approximations", () => {
  it("finds hedged figures", () => {
    expect(approximations("nearly 80 touchdowns and about 68 percent")).toEqual([
      { hedge: "nearly", value: 80 },
      { hedge: "about", value: 68 },
    ]);
  });

  it("does not treat a floor as an approximation", () => {
    expect(approximations("more than 4000 yards")).toEqual([]);
  });
});
