import type { FileReport, FileTrendInfo, Totals, Trends } from "../types.js";
import { scoreCommentRatio } from "../grading/scoreCommentRatio.js";
import type { HistoryData } from "./loadHistory.js";

/** Builds project-level deltas against previous totals. */
function createTrendTotals(
  currentReport: FileReport[],
  currentTotals: Totals,
  previousHistory: HistoryData,
): Trends["totals"] {
  return {
    security: currentTotals.security - previousHistory.totals.security,
    maintainability: currentTotals.maintainability - previousHistory.totals.maintainability,
    cleanliness: currentTotals.cleanliness - previousHistory.totals.cleanliness,
    scannerErrors: currentTotals.scannerErrors - previousHistory.totals.scannerErrors,
    avgCognitive: currentTotals.avgCognitive - previousHistory.totals.avgCognitive,
    avgCyclomatic: currentTotals.avgCyclomatic - previousHistory.totals.avgCyclomatic,
    files: currentReport.length - previousHistory.totals.files,
  };
}

/** Builds all file-level metric deltas. */
function createFileTrend(
  current: FileReport,
  previous: HistoryData["files"][string],
): FileTrendInfo {
  return {
    file: current.relativePath,
    cognitive: current.cognitive - previous.cognitive,
    cyclomatic: current.cyclomatic - previous.cyclomatic,
    security: current.security - previous.security,
    maintainability: current.maintainability - previous.maintainability,
    cleanliness: current.cleanliness - previous.cleanliness,
    scannerErrors: current.scannerErrors - previous.scannerErrors,
    commentRatio: current.commentRatio - previous.commentRatio,
    commentRatioQuality:
      scoreCommentRatio(current.commentRatio) - scoreCommentRatio(previous.commentRatio),
  };
}

/** Returns whether at least one file metric improved. */
function hasImprovement(delta: FileTrendInfo): boolean {
  return (
    delta.cognitive < 0 ||
    delta.cyclomatic < 0 ||
    delta.security < 0 ||
    delta.maintainability < 0 ||
    delta.cleanliness < 0 ||
    delta.scannerErrors < 0 ||
    delta.commentRatioQuality > 0
  );
}

/** Returns whether at least one file metric regressed. */
function hasRegression(delta: FileTrendInfo): boolean {
  return (
    delta.cognitive > 0 ||
    delta.cyclomatic > 0 ||
    delta.security > 0 ||
    delta.maintainability > 0 ||
    delta.cleanliness > 0 ||
    delta.scannerErrors > 0 ||
    delta.commentRatioQuality < 0
  );
}

/** Classifies current files as new, improved, or regressed. */
function classifyCurrentFiles(
  currentReport: FileReport[],
  previousHistory: HistoryData,
  trends: Trends,
): void {
  for (const current of currentReport) {
    const previous = previousHistory.files[current.relativePath];
    if (!previous) {
      trends.new.push(current.relativePath);
      continue;
    }
    const delta = createFileTrend(current, previous);
    if (hasImprovement(delta)) trends.improved.push(delta);
    if (hasRegression(delta)) trends.regressed.push(delta);
  }
}

/** Finds files that existed only in the previous scan. */
function findRemovedFiles(currentReport: FileReport[], previousHistory: HistoryData): string[] {
  const currentFiles = new Set(currentReport.map((file) => file.relativePath));
  return Object.keys(previousHistory.files).filter((filePath) => !currentFiles.has(filePath));
}

/** Calculates project and file trends against compatible history. */
export function calculateTrends(
  currentReport: FileReport[],
  currentTotals: Totals,
  previousHistory: HistoryData | null,
): Trends | null {
  if (!previousHistory) return null;
  const trends: Trends = {
    totals: createTrendTotals(currentReport, currentTotals, previousHistory),
    improved: [],
    regressed: [],
    new: [],
    removed: findRemovedFiles(currentReport, previousHistory),
  };
  classifyCurrentFiles(currentReport, previousHistory, trends);
  return trends;
}
