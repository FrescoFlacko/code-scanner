import { describe, expect, it } from "vitest";
import { calculateGrade } from "./calculateGrade.js";

describe("calculateGrade", () => {
  it.each([
    { security: 0, expected: "A" },
    { security: 1, expected: "C" },
    { security: 3, expected: "D" },
    { security: 5, expected: "F" },
  ] as const)(
    "applies the security cap for $security issues",
    ({ security, expected }) => {
      expect(
        calculateGrade({
          cognitive: 0,
          cyclomatic: 0,
          security,
          maintainability: 0,
          cleanliness: 0,
          commentRatio: 10,
        }),
      ).toBe(expected);
    },
  );
});
