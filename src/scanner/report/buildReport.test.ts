import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReport } from "./buildReport.js";
import type { ESLintResult, RuleCategories } from "../types.js";

const tempDirectories: string[] = [];
const categories: RuleCategories = {
  security: [],
  maintainability: [],
  cleanliness: [],
  metrics: [],
};

afterEach(() => {
  for (const directory of tempDirectories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

function resultWithMessage(message: ESLintResult["messages"][number]): ESLintResult {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-report-"));
  tempDirectories.push(directory);
  const filePath = path.join(directory, "invalid.ts");
  fs.writeFileSync(filePath, "export const value: = 1;\n");
  return { filePath, messages: [message], errorCount: 1, warningCount: 0 };
}

describe("buildReport scanner errors", () => {
  it("reports fatal parser messages and forces grade F", () => {
    const result = resultWithMessage({
      ruleId: null,
      fatal: true,
      severity: 2,
      message: "Parsing error",
      line: 1,
      column: 21,
    });
    const [report] = buildReport([result], categories, path.dirname(result.filePath));

    expect(report.grade).toBe("F");
    expect(report.scannerErrors).toBe(1);
    expect(report.issues).toEqual([
      { rule: "scanner-error", category: "other", line: 1, message: "Parsing error", count: 1 },
    ]);
  });

  it("treats rule-less ESLint errors as scanner errors even without a fatal flag", () => {
    const result = resultWithMessage({
      ruleId: null,
      severity: 2,
      message: "Configuration failed",
      line: 1,
      column: 1,
    });
    expect(buildReport([result], categories, path.dirname(result.filePath))[0]).toMatchObject({
      grade: "F",
      scannerErrors: 1,
    });
  });
});

describe("buildReport metric probes", () => {
  it("extracts complexity without counting the probe as a maintainability issue", () => {
    const result = resultWithMessage({
      ruleId: "complexity",
      severity: 1,
      message: "Function 'example' has a complexity of 7. Maximum allowed is 0.",
      line: 1,
      column: 1,
    });
    const metricCategories: RuleCategories = { ...categories, metrics: ["complexity"] };

    const [report] = buildReport([result], metricCategories, path.dirname(result.filePath));

    expect(report.cyclomatic).toBe(7);
    expect(report.maintainability).toBe(0);
    expect(report.issues).toEqual([]);
  });
});
