import { describe, expect, it } from "vitest";
import { calculateTotals } from "./calculateTotals.js";
import type { FileReport } from "../types.js";

function report(scannerErrors: number): FileReport {
  return {
    file: "example.ts",
    relativePath: "example.ts",
    cognitive: 0,
    cyclomatic: 0,
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    scannerErrors,
    commentRatio: 0,
    grade: scannerErrors > 0 ? "F" : "A",
    issues: [],
  };
}

describe("calculateTotals", () => {
  it("keeps operational failures visible when there are no code findings", () => {
    expect(calculateTotals([report(2), report(0)])).toMatchObject({
      security: 0,
      maintainability: 0,
      cleanliness: 0,
      scannerErrors: 2,
    });
  });
});
