import { describe, it, expect } from "vitest";
import { calculatePriorities } from "./calculatePriorities.js";
import type { FileReport, Totals } from "../types.js";

function createMockFile(overrides: Partial<FileReport> = {}): FileReport {
  return {
    file: "test.ts",
    relativePath: "test.ts",
    cognitive: 0,
    cyclomatic: 0,
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    scannerErrors: 0,
    commentRatio: 10,
    grade: "A",
    issues: [],
    ...overrides,
  };
}

function createMockTotals(overrides: Partial<Totals> = {}): Totals {
  return {
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    scannerErrors: 0,
    avgCognitive: 0,
    avgCyclomatic: 0,
    ...overrides,
  };
}

describe("calculatePriorities", () => {
  describe("empty report", () => {
    it("returns empty items for empty report", () => {
      const result = calculatePriorities([], createMockTotals());
      expect(result.items).toEqual([]);
      expect(result.overallImprovementPct).toBe(0);
    });
  });

  describe("sorting by score", () => {
    it("prioritizes incomplete scans above code-quality findings", () => {
      const files = [
        createMockFile({ file: "security.ts", relativePath: "security.ts", security: 20, grade: "F" }),
        createMockFile({ file: "unscanned.ts", relativePath: "unscanned.ts", scannerErrors: 1, grade: "F" }),
      ];

      const result = calculatePriorities(files, createMockTotals({ security: 20, scannerErrors: 1 }));

      expect(result.items[0]).toMatchObject({
        file: "unscanned.ts",
        projectedGrade: "F",
        primaryReason: "Scanner Failed (1 operational error)",
        impact: { scannerErrorReduction: 1, scannerErrorPercentage: 100 },
      });
      expect(result.overallImprovementPct).toBeGreaterThan(99);
    });

    it("sorts files by priority score descending", () => {
      const files = [
        createMockFile({ file: "low.ts", relativePath: "low.ts", security: 0, maintainability: 5 }),
        createMockFile({ file: "high.ts", relativePath: "high.ts", security: 5, maintainability: 10 }),
        createMockFile({ file: "medium.ts", relativePath: "medium.ts", security: 2, maintainability: 8 }),
      ];
      const totals = createMockTotals({ security: 7, maintainability: 23 });

      const result = calculatePriorities(files, totals);

      expect(result.items[0].file).toBe("high.ts");
      expect(result.items[1].file).toBe("medium.ts");
      expect(result.items[2].file).toBe("low.ts");
    });
  });

  describe("returns max 3 items", () => {
    it("returns only top 3 files", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", security: 1 }),
        createMockFile({ file: "b.ts", relativePath: "b.ts", security: 2 }),
        createMockFile({ file: "c.ts", relativePath: "c.ts", security: 3 }),
        createMockFile({ file: "d.ts", relativePath: "d.ts", security: 4 }),
        createMockFile({ file: "e.ts", relativePath: "e.ts", security: 5 }),
      ];
      const totals = createMockTotals({ security: 15 });

      const result = calculatePriorities(files, totals);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].file).toBe("e.ts");
      expect(result.items[1].file).toBe("d.ts");
      expect(result.items[2].file).toBe("c.ts");
    });

    it("returns fewer than 3 if report has fewer files", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", security: 1 }),
        createMockFile({ file: "b.ts", relativePath: "b.ts", security: 2 }),
      ];
      const totals = createMockTotals({ security: 3 });

      const result = calculatePriorities(files, totals);

      expect(result.items).toHaveLength(2);
    });
  });

  describe("primary reason", () => {
    it("shows security issues as primary reason when present", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", security: 5, grade: "F" }),
      ];
      const totals = createMockTotals({ security: 5 });

      const result = calculatePriorities(files, totals);

      expect(result.items[0].primaryReason).toBe("5 Security Issues");
    });

    it("shows singular form for 1 security issue", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", security: 1, grade: "D" }),
      ];
      const totals = createMockTotals({ security: 1 });

      const result = calculatePriorities(files, totals);

      expect(result.items[0].primaryReason).toBe("1 Security Issue");
    });

    it("shows high cognitive complexity when no security issues", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", cognitive: 20, grade: "D" }),
      ];
      const totals = createMockTotals();

      const result = calculatePriorities(files, totals);

      expect(result.items[0].primaryReason).toBe("High Complexity (Cognitive 20)");
    });

    it("shows maintainability hotspot when relevant", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", maintainability: 15, grade: "C" }),
      ];
      const totals = createMockTotals({ maintainability: 15 });

      const result = calculatePriorities(files, totals);

      expect(result.items[0].primaryReason).toBe("Maintainability Hotspot (15 issues)");
    });
  });

  describe("impact percentages", () => {
    it("calculates correct security percentage", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", security: 5, grade: "F" }),
      ];
      const totals = createMockTotals({ security: 10 });

      const result = calculatePriorities(files, totals);

      expect(result.items[0].impact.securityReduction).toBe(5);
      expect(result.items[0].impact.securityPercentage).toBe(50);
    });

    it("handles zero totals without division by zero", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts" }),
      ];
      const totals = createMockTotals({ security: 0, maintainability: 0, cleanliness: 0 });

      const result = calculatePriorities(files, totals);

      expect(result.items[0].impact.securityPercentage).toBe(0);
      expect(result.items[0].impact.maintainabilityPercentage).toBe(0);
      expect(result.items[0].impact.cleanlinessPercentage).toBe(0);
    });
  });

  describe("projected grade", () => {
    it("projects grade A when all issues fixed", () => {
      const files = [
        createMockFile({ 
          file: "a.ts", 
          relativePath: "a.ts", 
          security: 5, 
          maintainability: 10, 
          cognitive: 20,
          cyclomatic: 15,
          grade: "F" 
        }),
      ];
      const totals = createMockTotals({ security: 5, maintainability: 10 });

      const result = calculatePriorities(files, totals);

      expect(result.items[0].currentGrade).toBe("F");
      expect(result.items[0].projectedGrade).toBe("A");
    });
  });

  describe("overall improvement percentage", () => {
    it("calculates overall improvement from top 3", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts", security: 10, maintainability: 10, cleanliness: 10, grade: "F" }),
      ];
      const totals = createMockTotals({ security: 10, maintainability: 10, cleanliness: 10 });

      const result = calculatePriorities(files, totals);

      expect(result.overallImprovementPct).toBe(100);
    });

    it("returns 0 when no weighted issues", () => {
      const files = [
        createMockFile({ file: "a.ts", relativePath: "a.ts" }),
      ];
      const totals = createMockTotals();

      const result = calculatePriorities(files, totals);

      expect(result.overallImprovementPct).toBe(0);
    });
  });
});
