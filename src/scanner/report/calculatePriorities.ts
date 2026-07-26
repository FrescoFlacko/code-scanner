import { THRESHOLDS } from "../../../scanner.config.js";
import { calculateGrade } from "../grading/calculateGrade.js";
import type { FileReport, Totals, PriorityItem, PrioritiesResult, Grade } from "../types.js";

function calculatePriorityScore(file: FileReport): number {
  return (
    file.scannerErrors * 1_000_000 +
    file.security * 100 +
    file.cognitive * 2 +
    file.cyclomatic * 2 +
    file.maintainability * 1.5 +
    file.cleanliness * 1
  );
}

function determinePrimaryReason(file: FileReport): string {
  if (file.scannerErrors > 0) {
    return `Scanner Failed (${file.scannerErrors} operational error${file.scannerErrors > 1 ? "s" : ""})`;
  }
  if (file.security > 0) {
    return `${file.security} Security Issue${file.security > 1 ? "s" : ""}`;
  }
  if (file.cognitive >= THRESHOLDS.cognitive.medium) {
    return `High Complexity (Cognitive ${file.cognitive})`;
  }
  if (file.cyclomatic >= THRESHOLDS.cyclomatic.medium) {
    return `High Complexity (Cyclomatic ${file.cyclomatic})`;
  }
  if (file.maintainability >= THRESHOLDS.maintainability.medium) {
    return `Maintainability Hotspot (${file.maintainability} issues)`;
  }
  const total = file.security + file.maintainability + file.cleanliness;
  return `Most Issues (${total} total)`;
}

function calculateProjectedGrade(file: FileReport): Grade {
  if (file.scannerErrors > 0) return "F";
  const zeroedMetrics = {
    cognitive: 0,
    cyclomatic: 0,
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    commentRatio: file.commentRatio,
  };
  return calculateGrade(zeroedMetrics);
}

function safePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function calculatePriorities(report: FileReport[], totals: Totals): PrioritiesResult {
  if (report.length === 0) {
    return { items: [], overallImprovementPct: 0 };
  }

  const scored = report.map((file) => ({
    file,
    score: calculatePriorityScore(file),
  }));

  scored.sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);

  const items: PriorityItem[] = top3.map(({ file, score }) => ({
    file: file.file,
    relativePath: file.relativePath,
    currentGrade: file.grade,
    projectedGrade: calculateProjectedGrade(file),
    primaryReason: determinePrimaryReason(file),
    impact: {
      scannerErrorReduction: file.scannerErrors,
      scannerErrorPercentage: safePercentage(file.scannerErrors, totals.scannerErrors),
      securityReduction: file.security,
      securityPercentage: safePercentage(file.security, totals.security),
      maintainabilityReduction: file.maintainability,
      maintainabilityPercentage: safePercentage(file.maintainability, totals.maintainability),
      cleanlinessReduction: file.cleanliness,
      cleanlinessPercentage: safePercentage(file.cleanliness, totals.cleanliness),
    },
    score,
  }));

  const totalWeightedIssues =
    totals.scannerErrors * 1_000_000 +
    totals.security * 100 +
    totals.maintainability * 1.5 +
    totals.cleanliness * 1;

  const top3WeightedIssues = top3.reduce((sum, { file }) => {
    return (
      sum +
      file.scannerErrors * 1_000_000 +
      file.security * 100 +
      file.maintainability * 1.5 +
      file.cleanliness * 1
    );
  }, 0);

  const overallImprovementPct =
    totalWeightedIssues > 0 ? Math.round((top3WeightedIssues / totalWeightedIssues) * 100) : 0;

  return { items, overallImprovementPct };
}
