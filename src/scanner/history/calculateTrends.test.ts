import { describe, it, expect } from "vitest";
import { calculateTrends } from "./calculateTrends.js";
import type { FileReport, Totals } from "../types.js";
import type { HistoryData } from "./loadHistory.js";

function makeFileReport(overrides: Partial<FileReport> = {}): FileReport {
  return {
    file: "/test/file.ts",
    relativePath: "file.ts",
    cognitive: 5,
    cyclomatic: 3,
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    scannerErrors: 0,
    commentRatio: 0.1,
    grade: "A",
    issues: [],
    ...overrides,
  };
}

function makeTotals(overrides: Partial<Totals> = {}): Totals {
  return {
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    scannerErrors: 0,
    avgCognitive: 5,
    avgCyclomatic: 3,
    ...overrides,
  };
}

function makeHistoryData(overrides: Partial<HistoryData> = {}): HistoryData {
  return {
    version: 3,
    configurationVersion: 1,
    configurationFingerprint: "a".repeat(64),
    profiles: ["generic"],
    timestamp: "2025-01-01T00:00:00.000Z",
    totals: {
      files: 1,
      security: 0,
      maintainability: 0,
      cleanliness: 0,
      scannerErrors: 0,
      avgCognitive: 5,
      avgCyclomatic: 3,
    },
    files: {},
    ...overrides,
  };
}

describe("calculateTrends", () => {
  describe("when no previous history", () => {
    it("returns null", () => {
      const report = [makeFileReport()];
      const totals = makeTotals();

      const result = calculateTrends(report, totals, null);

      expect(result).toBeNull();
    });
  });

  describe("totals comparison", () => {
    it("calculates differences in totals", () => {
      const report = [makeFileReport({ relativePath: "file.ts" })];
      const totals = makeTotals({
        security: 5,
        maintainability: 10,
        cleanliness: 15,
        avgCognitive: 8,
        avgCyclomatic: 4,
      });
      const history = makeHistoryData({
        totals: {
          files: 1,
          security: 3,
          maintainability: 5,
          cleanliness: 10,
          avgCognitive: 6,
          avgCyclomatic: 3,
        },
        files: {
          "file.ts": {
            cognitive: 6,
            cyclomatic: 3,
            security: 3,
            maintainability: 5,
            cleanliness: 10,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result).not.toBeNull();
      expect(result!.totals.security).toBe(2); // 5 - 3
      expect(result!.totals.maintainability).toBe(5); // 10 - 5
      expect(result!.totals.cleanliness).toBe(5); // 15 - 10
      expect(result!.totals.avgCognitive).toBe(2); // 8 - 6
      expect(result!.totals.avgCyclomatic).toBe(1); // 4 - 3
    });

    it("calculates file count difference", () => {
      const report = [
        makeFileReport({ relativePath: "file1.ts" }),
        makeFileReport({ relativePath: "file2.ts" }),
      ];
      const totals = makeTotals();
      const history = makeHistoryData({
        totals: {
          files: 1,
          security: 0,
          maintainability: 0,
          cleanliness: 0,
          avgCognitive: 5,
          avgCyclomatic: 3,
        },
        files: {
          "file1.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.totals.files).toBe(1); // 2 - 1
    });
  });

  describe("new files", () => {
    it("identifies files not in previous history", () => {
      const report = [
        makeFileReport({ relativePath: "existing.ts" }),
        makeFileReport({ relativePath: "new-file.ts" }),
      ];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "existing.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.new).toContain("new-file.ts");
      expect(result!.new).not.toContain("existing.ts");
    });
  });

  describe("removed files", () => {
    it("identifies files in history but not in current report", () => {
      const report = [makeFileReport({ relativePath: "remaining.ts" })];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "remaining.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
          "deleted.ts": {
            cognitive: 10,
            cyclomatic: 5,
            security: 2,
            maintainability: 3,
            cleanliness: 5,
            commentRatio: 0.05,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.removed).toContain("deleted.ts");
      expect(result!.removed).not.toContain("remaining.ts");
    });
  });

  describe("improved files", () => {
    it("identifies files with reduced cognitive complexity", () => {
      const report = [makeFileReport({ relativePath: "improved.ts", cognitive: 3 })];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "improved.ts": {
            cognitive: 10,
            cyclomatic: 5,
            security: 0,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.improved).toHaveLength(1);
      expect(result!.improved[0].file).toBe("improved.ts");
      expect(result!.improved[0].cognitive).toBe(-7); // 3 - 10
    });

    it("identifies files with reduced security issues", () => {
      const report = [makeFileReport({ relativePath: "secured.ts", security: 1 })];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "secured.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 5,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.improved).toHaveLength(1);
      expect(result!.improved[0].file).toBe("secured.ts");
      expect(result!.improved[0].security).toBe(-4); // 1 - 5
    });
  });

  describe("regressed files", () => {
    it("identifies files with increased cognitive complexity", () => {
      const report = [makeFileReport({ relativePath: "worse.ts", cognitive: 15 })];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "worse.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.regressed).toHaveLength(1);
      expect(result!.regressed[0].file).toBe("worse.ts");
      expect(result!.regressed[0].cognitive).toBe(10); // 15 - 5
    });

    it("identifies files with increased security issues", () => {
      const report = [makeFileReport({ relativePath: "risky.ts", security: 8 })];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "risky.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 2,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.regressed).toHaveLength(1);
      expect(result!.regressed[0].file).toBe("risky.ts");
      expect(result!.regressed[0].security).toBe(6); // 8 - 2
    });

    it("identifies files with increased maintainability issues", () => {
      const report = [makeFileReport({ relativePath: "messy.ts", maintainability: 20 })];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "messy.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 10,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.regressed).toHaveLength(1);
      expect(result!.regressed[0].file).toBe("messy.ts");
      expect(result!.regressed[0].maintainability).toBe(10); // 20 - 10
    });

    it("identifies any maintainability regression consistently", () => {
      const report = [
        makeFileReport({
          relativePath: "ok.ts",
          maintainability: 15,
          cognitive: 5,
          security: 0,
        }),
      ];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "ok.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 10,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.regressed).toHaveLength(1);
    });
  });

  describe("comment ratio quality", () => {
    /** Calculates trends for a file whose only change is its comment ratio. */
    function calculateCommentRatioTrend(previousCommentRatio: number, currentCommentRatio: number) {
      const report = [
        makeFileReport({
          relativePath: "comments.ts",
          commentRatio: currentCommentRatio,
        }),
      ];
      const history = makeHistoryData({
        files: {
          "comments.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: previousCommentRatio,
          },
        },
      });

      return calculateTrends(report, makeTotals(), history)!;
    }

    it("treats movement farther above the ideal range as a regression", () => {
      const result = calculateCommentRatioTrend(40, 80);

      expect(result.improved).toHaveLength(0);
      expect(result.regressed).toHaveLength(1);
    });

    it("treats movement from above the ideal range into it as an improvement", () => {
      const result = calculateCommentRatioTrend(80, 30);

      expect(result.improved).toHaveLength(1);
      expect(result.regressed).toHaveLength(0);
    });

    it("treats movement toward the ideal range from below as an improvement", () => {
      const result = calculateCommentRatioTrend(2, 4);

      expect(result.improved).toHaveLength(1);
      expect(result.regressed).toHaveLength(0);
    });

    it("treats equal-quality movement within the ideal range as neutral", () => {
      const result = calculateCommentRatioTrend(10, 20);

      expect(result.improved).toHaveLength(0);
      expect(result.regressed).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty report", () => {
      const report: FileReport[] = [];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "old.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 0,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.removed).toContain("old.ts");
      expect(result!.new).toHaveLength(0);
      expect(result!.improved).toHaveLength(0);
      expect(result!.regressed).toHaveLength(0);
    });

    it("handles empty previous history files", () => {
      const report = [makeFileReport({ relativePath: "new.ts" })];
      const totals = makeTotals();
      const history = makeHistoryData({ files: {} });

      const result = calculateTrends(report, totals, history);

      expect(result!.new).toContain("new.ts");
      expect(result!.removed).toHaveLength(0);
    });

    it("file can be both improved and regressed (different metrics)", () => {
      const report = [
        makeFileReport({
          relativePath: "mixed.ts",
          cognitive: 20,
          security: 0,
        }),
      ];
      const totals = makeTotals();
      const history = makeHistoryData({
        files: {
          "mixed.ts": {
            cognitive: 5,
            cyclomatic: 3,
            security: 5,
            maintainability: 0,
            cleanliness: 0,
            commentRatio: 0.1,
          },
        },
      });

      const result = calculateTrends(report, totals, history);

      expect(result!.improved).toHaveLength(1);
      expect(result!.improved[0].security).toBe(-5);

      expect(result!.regressed).toHaveLength(1);
      expect(result!.regressed[0].cognitive).toBe(15);
    });
  });
});
