import type { FileReport, Totals, Trends } from "../types.js";
import type { HistoryData } from "./loadHistory.js";

export function calculateTrends(currentReport: FileReport[], currentTotals: Totals, previousHistory: HistoryData | null): Trends | null {
  if (!previousHistory) {
    return null;
  }

  const trends: Trends = {
    totals: {
      security: currentTotals.security - previousHistory.totals.security,
      maintainability: currentTotals.maintainability - previousHistory.totals.maintainability,
      cleanliness: currentTotals.cleanliness - previousHistory.totals.cleanliness,
      avgCognitive: currentTotals.avgCognitive - previousHistory.totals.avgCognitive,
      avgCyclomatic: currentTotals.avgCyclomatic - previousHistory.totals.avgCyclomatic,
      files: currentReport.length - previousHistory.totals.files,
    },
    improved: [],
    regressed: [],
    new: [],
    removed: [],
  };

  const previousFiles = new Set(Object.keys(previousHistory.files));
  const currentFiles = new Set(currentReport.map((r) => r.relativePath));

  currentReport.forEach((r) => {
    const prev = previousHistory.files[r.relativePath];

    if (!prev) {
      trends.new.push(r.relativePath);
      return;
    }

    const cogDiff = r.cognitive - prev.cognitive;
    const secDiff = r.security - prev.security;
    const maintDiff = r.maintainability - prev.maintainability;

    if (cogDiff < 0 || secDiff < 0) {
      trends.improved.push({
        file: r.relativePath,
        cognitive: cogDiff,
        security: secDiff,
      });
    }

    if (cogDiff > 0 || secDiff > 0 || maintDiff > 5) {
      trends.regressed.push({
        file: r.relativePath,
        cognitive: cogDiff,
        security: secDiff,
        maintainability: maintDiff,
      });
    }
  });

  previousFiles.forEach((filePath) => {
    if (!currentFiles.has(filePath)) {
      trends.removed.push(filePath);
    }
  });

  return trends;
}
