import { afterEach, describe, expect, it, vi } from "vitest";
import type { Trends } from "../types.js";
import type { HistoryData } from "./loadHistory.js";
import { printTrends } from "./printTrends.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printTrends", () => {
  it("prints total, file, and inventory changes", () => {
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value = "") => {
      output.push(String(value));
    });
    const previousHistory = {
      timestamp: "2026-01-01T00:00:00.000Z",
      totals: { avgCognitive: 10 },
    } as HistoryData;
    const trends: Trends = {
      totals: {
        security: -1,
        maintainability: 2,
        cleanliness: -3,
        scannerErrors: 1,
        avgCognitive: -2,
        avgCyclomatic: 0,
        files: 1,
      },
      regressed: [
        {
          file: "regressed.ts",
          cognitive: 1,
          cyclomatic: 2,
          security: 1,
          maintainability: 1,
          cleanliness: 1,
          scannerErrors: 1,
          commentRatio: -2,
          commentRatioQuality: -1,
        },
      ],
      improved: [
        {
          file: "improved.ts",
          cognitive: -1,
          cyclomatic: -2,
          security: -1,
          maintainability: -1,
          cleanliness: -1,
          scannerErrors: -1,
          commentRatio: 2,
          commentRatioQuality: 1,
        },
      ],
      new: ["new.ts"],
      removed: ["removed.ts"],
    };

    printTrends(trends, previousHistory);

    expect(output.join("\n")).toContain("Scanner errors increased by 1");
    expect(output.join("\n")).toContain("Security issues decreased by 1");
    expect(output.join("\n")).toContain(
      "regressed.ts (cognitive +1, cyclomatic +2, security +1, maintainability +1, cleanliness +1, scanner errors +1, comment ratio -2.000)",
    );
    expect(output.join("\n")).toContain(
      "improved.ts (cognitive -1, cyclomatic -2, security -1, maintainability -1, cleanliness -1, scanner errors -1, comment ratio +2.000)",
    );
    expect(output.join("\n")).toContain("New files: 1");
    expect(output.join("\n")).toContain("Removed files: 1");
  });

  it.each([
    ["average cyclomatic complexity", { avgCyclomatic: 1 }, {}],
    ["file count", { files: 1 }, {}],
    ["an improved file", {}, { improved: [{}] }],
    ["a regressed file", {}, { regressed: [{}] }],
    ["a new file", {}, { new: ["new.ts"] }],
    ["a removed file", {}, { removed: ["removed.ts"] }],
  ])(
    "does not report no significant changes for %s",
    (_, totalChanges, listChanges) => {
      const output: string[] = [];
      vi.spyOn(console, "log").mockImplementation((value = "") => {
        output.push(String(value));
      });
      const previousHistory = {
        timestamp: "2026-01-01T00:00:00.000Z",
        totals: { avgCognitive: 10 },
      } as HistoryData;
      const fileTrend = {
        file: "changed.ts",
        cognitive: 0,
        cyclomatic: 0,
        security: 0,
        maintainability: 0,
        cleanliness: 0,
        scannerErrors: 0,
        commentRatio: 0,
        commentRatioQuality: 0,
      };
      const trends: Trends = {
        totals: {
          security: 0,
          maintainability: 0,
          cleanliness: 0,
          scannerErrors: 0,
          avgCognitive: 0,
          avgCyclomatic: 0,
          files: 0,
          ...totalChanges,
        },
        improved: [],
        regressed: [],
        new: [],
        removed: [],
        ...Object.fromEntries(
          Object.entries(listChanges).map(([key, value]) => [
            key,
            key === "improved" || key === "regressed" ? [fileTrend] : value,
          ]),
        ),
      };

      printTrends(trends, previousHistory);

      expect(output.join("\n")).not.toContain(
        "No significant changes since last scan.",
      );
    },
  );
});
