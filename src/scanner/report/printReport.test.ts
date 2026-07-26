import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileReport, Totals } from "../types.js";
import { getDisplayWidth } from "./tableFormatting.js";
import { printReport } from "./printReport.js";

const totals: Totals = {
  security: 0,
  maintainability: 0,
  cleanliness: 0,
  scannerErrors: 0,
  avgCognitive: 0,
  avgCyclomatic: 0,
};

/** Creates a complete report fixture with optional overrides. */
function createReport(overrides: Partial<FileReport> = {}): FileReport {
  return {
    file: "Component.tsx",
    relativePath: "src/features/league/components/Component.tsx",
    cognitive: 10,
    cyclomatic: 12,
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    scannerErrors: 0,
    commentRatio: 0,
    grade: "A",
    issues: [],
    ...overrides,
  };
}

/** Returns text written through console.log during a callback. */
function captureConsole(callback: () => void): string[] {
  const output: string[] = [];
  vi.spyOn(console, "log").mockImplementation((value = "") => output.push(String(value)));
  callback();
  return output;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printReport", () => {
  it("prints a shortened relative path without exceeding a narrow terminal", () => {
    const output = captureConsole(() =>
      printReport(
        [
          createReport({
            relativePath: "src/features/league/components/HistoricalLeagueInfoErrorBoundary.tsx",
          }),
        ],
        totals,
        { terminalWidth: 80 },
      ),
    );
    const tableRow = output.find((line) => line.startsWith("src/…/"));

    expect(tableRow).toBeDefined();
    expect(tableRow).toContain("src/…/");
    expect(tableRow).not.toContain("Component.tsx | ");
    expect(getDisplayWidth(tableRow!)).toBeLessThanOrEqual(80);
  });

  it("uses more of a wide terminal and keeps emoji grades aligned", () => {
    const output = captureConsole(() =>
      printReport(
        [
          createReport({
            relativePath: "src/功能/🚀Component.tsx",
            grade: "A",
          }),
          createReport({
            relativePath: "src/components/Other.tsx",
            grade: "F",
          }),
        ],
        totals,
        { terminalWidth: 140 },
      ),
    );
    const rows = output.filter((line) => line.includes(" | ") && !line.startsWith("File"));
    const separatorWidths = rows.map((line) => getDisplayWidth(line.slice(0, line.indexOf(" | "))));

    expect(rows[0]).toContain("src/功能/🚀Component.tsx");
    expect(separatorWidths).toEqual([separatorWidths[0], separatorWidths[0]]);
    expect(rows.every((line) => getDisplayWidth(line) <= 140)).toBe(true);
  });

  it("uses a vertical layout below the minimum horizontal table width", () => {
    const output = captureConsole(() =>
      printReport([createReport({ commentRatio: 10 })], totals, {
        terminalWidth: 60,
      }),
    );

    expect(output).toContain("File: src/features/league/components/Component.tsx");
    expect(output.some((line) => line.includes(" | "))).toBe(false);
    expect(output.every((line) => getDisplayWidth(line) <= 60)).toBe(true);
  });

  it("does not report missing documentation when comments are hidden for width", () => {
    const output = captureConsole(() =>
      printReport([createReport({ commentRatio: 10 })], totals, {
        terminalWidth: 80,
      }),
    );

    expect(output.some((line) => line.includes("Documentation is critically missing"))).toBe(false);
  });

  it("keeps the full relative path in detailed issue output", () => {
    const output = captureConsole(() =>
      printReport(
        [
          createReport({
            relativePath: "src/features/league/Component.tsx",
            issues: [
              {
                rule: "example/rule",
                category: "maintainability",
                line: 4,
                message: "Example issue",
                count: 1,
              },
            ],
          }),
        ],
        totals,
        { listIssues: true, terminalWidth: 80 },
      ),
    );

    expect(output).toContain("\n📂 src/features/league/Component.tsx");
  });
});
