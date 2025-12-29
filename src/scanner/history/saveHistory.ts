import fs from "fs";
import path from "path";
import { HISTORY_FILENAME } from "../constants.js";
import type { FileReport, Totals } from "../types.js";

export function saveHistory(targetPath: string, report: FileReport[], totals: Totals): void {
  const historyPath = path.join(targetPath, HISTORY_FILENAME);

  const fileResults: Record<string, {
    cognitive: number;
    cyclomatic: number;
    security: number;
    maintainability: number;
    cleanliness: number;
    commentRatio: number;
  }> = {};

  report.forEach((r) => {
    fileResults[r.relativePath] = {
      cognitive: r.cognitive,
      cyclomatic: r.cyclomatic,
      security: r.security,
      maintainability: r.maintainability,
      cleanliness: r.cleanliness,
      commentRatio: r.commentRatio,
    };
  });

  const history = {
    timestamp: new Date().toISOString(),
    totals: {
      files: report.length,
      security: totals.security,
      maintainability: totals.maintainability,
      cleanliness: totals.cleanliness,
      avgCognitive: totals.avgCognitive,
      avgCyclomatic: totals.avgCyclomatic,
    },
    files: fileResults,
  };

  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch {
    console.warn(`⚠️  Warning: Could not save history to ${HISTORY_FILENAME}`);
  }
}
