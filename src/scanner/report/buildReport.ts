import path from "path";
import { categorizeRule } from "../../../scanner.config.js";
import { calculateGrade } from "../grading/calculateGrade.js";
import { calculateCommentRatio } from "../metrics/calculateCommentRatio.js";
import type { ESLintResult, FileReport, Grade, Issue, RuleCategories } from "../types.js";

type LintMessage = ESLintResult["messages"][number];
type FileMetrics = Pick<
  FileReport,
  | "cognitive"
  | "cyclomatic"
  | "security"
  | "maintainability"
  | "cleanliness"
  | "scannerErrors"
  | "commentRatio"
>;

/** Extracts the display message embedded by the Sonar cyclomatic rule. */
function parseRuleMessage(ruleId: string | null, message: string): string {
  if (ruleId !== "sonarjs/cyclomatic-complexity" || !message.startsWith("{")) {
    return message;
  }
  try {
    const parsed = JSON.parse(message) as { message?: string };
    return parsed.message || message;
  } catch {
    return message;
  }
}

/** Creates zeroed metrics for a lint result. */
function createMetrics(filePath: string): FileMetrics {
  return {
    cognitive: 0,
    cyclomatic: 0,
    security: 0,
    maintainability: 0,
    cleanliness: 0,
    scannerErrors: 0,
    commentRatio: calculateCommentRatio(filePath),
  };
}

/** Adds a unique issue or increments its duplicate count. */
function addIssue(issueMap: Map<string, Issue>, key: string, issue: Omit<Issue, "count">): void {
  const existing = issueMap.get(key);
  if (existing) existing.count++;
  else issueMap.set(key, { ...issue, count: 1 });
}

/** Records an operational scanner failure and reports whether one occurred. */
function recordScannerError(
  message: LintMessage,
  metrics: FileMetrics,
  issueMap: Map<string, Issue>,
): boolean {
  const isScannerError =
    message.fatal === true || (message.ruleId === null && message.severity === 2);
  if (!isScannerError) return false;

  metrics.scannerErrors++;
  addIssue(issueMap, `${message.line}::other::scanner-error::${message.message}`, {
    rule: "scanner-error",
    category: "other",
    line: message.line,
    message: message.message,
  });
  return true;
}

/** Updates the maximum complexity metrics emitted for a file. */
function recordComplexity(message: LintMessage, metrics: FileMetrics): void {
  if (message.ruleId === "complexity") {
    const match = message.message.match(/complexity of (\d+)/);
    if (match) {
      metrics.cyclomatic = Math.max(metrics.cyclomatic, Number.parseInt(match[1], 10));
    }
  }
  if (message.ruleId === "sonarjs/cognitive-complexity") {
    const match = message.message.match(/Complexity from (\d+)/);
    if (match) {
      metrics.cognitive = Math.max(metrics.cognitive, Number.parseInt(match[1], 10));
    }
  }
}

/** Categorizes and records a code-quality issue. */
function recordCategorizedIssue(
  message: LintMessage,
  categories: RuleCategories,
  metrics: FileMetrics,
  issueMap: Map<string, Issue>,
): void {
  const category = categorizeRule(message.ruleId, categories);
  if (category === "other") return;

  metrics[category]++;
  const displayMessage = parseRuleMessage(message.ruleId, message.message);
  addIssue(issueMap, `${message.line}::${category}::${message.ruleId}::${displayMessage}`, {
    rule: message.ruleId || "",
    category,
    line: message.line,
    message: displayMessage,
  });
}

/** Sorts issues by source line and then rule identifier. */
function sortIssues(issueMap: Map<string, Issue>): Issue[] {
  return Array.from(issueMap.values()).sort((left, right) => {
    if (left.line !== right.line) return left.line - right.line;
    return left.rule.localeCompare(right.rule);
  });
}

/** Converts one ESLint result into the scanner's file report contract. */
function buildFileReport(
  result: ESLintResult,
  categories: RuleCategories,
  targetPath: string,
): FileReport {
  const metrics = createMetrics(result.filePath);
  const issueMap = new Map<string, Issue>();
  let hasScannerError = false;

  for (const message of result.messages) {
    hasScannerError = recordScannerError(message, metrics, issueMap) || hasScannerError;
    recordComplexity(message, metrics);
    recordCategorizedIssue(message, categories, metrics, issueMap);
  }

  const grade: Grade = hasScannerError ? "F" : calculateGrade(metrics);
  return {
    file: path.basename(result.filePath),
    relativePath: path.relative(targetPath, result.filePath),
    ...metrics,
    grade,
    issues: sortIssues(issueMap),
  };
}

/** Builds scanner reports from ESLint results. */
export function buildReport(
  eslintResults: ESLintResult[],
  categories: RuleCategories,
  targetPath: string,
): FileReport[] {
  return eslintResults.map((result) => buildFileReport(result, categories, targetPath));
}
