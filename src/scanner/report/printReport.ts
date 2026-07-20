import { THRESHOLDS } from "../../../scanner.config.js";
import { getGradeDisplay } from "../grading/calculateGrade.js";
import type { FileReport, Totals } from "../types.js";
import {
  canShowCommentColumn,
  canShowHorizontalTable,
  getDisplayWidth,
  getFileColumnWidth,
  padToDisplayWidth,
  resolveTerminalWidth,
  truncatePath,
} from "./tableFormatting.js";

interface PrintReportOptions {
  listIssues?: boolean;
  /** Overrides terminal detection for deterministic programmatic output. */
  terminalWidth?: number;
}

interface ColumnWidths {
  file: number;
  grade: number;
  cognitive: number;
  cyclomatic: number;
  security: number;
  maintain: number;
  clean: number;
  comment: number;
}

/** Calculates the rounded average comment coverage for the report. */
function getAverageCommentRatio(report: FileReport[]): number {
  if (report.length === 0) return 0;
  const total = report.reduce((sum, file) => sum + file.commentRatio, 0);
  return Math.round(total / report.length);
}

/** Prints the project documentation warning when coverage is critical. */
function printDocumentationWarning(
  report: FileReport[],
  averageCommentRatio: number,
): void {
  if (averageCommentRatio < 5 && report.length > 0) {
    console.log(
      `⚠️  Documentation is critically missing across the project (${averageCommentRatio}% coverage).\n`,
    );
  }
}

/** Resolves widths for every horizontal report column. */
function getColumnWidths(
  terminalWidth: number,
  hideCommentColumn: boolean,
): ColumnWidths {
  return {
    file: getFileColumnWidth(terminalWidth, !hideCommentColumn),
    grade: 5,
    cognitive: 9,
    cyclomatic: 10,
    security: 8,
    maintain: 8,
    clean: 5,
    comment: 9,
  };
}

/** Builds the horizontal table header. */
function buildHeader(widths: ColumnWidths, hideCommentColumn: boolean): string {
  const parts = [
    padToDisplayWidth("File", widths.file),
    padToDisplayWidth("Grade", widths.grade),
    padToDisplayWidth("Cognitive", widths.cognitive),
    padToDisplayWidth("Cyclomatic", widths.cyclomatic),
    padToDisplayWidth("Security", widths.security),
    padToDisplayWidth("Maintain", widths.maintain),
    padToDisplayWidth("Clean", widths.clean),
  ];
  if (!hideCommentColumn) {
    parts.push(padToDisplayWidth("Comment %", widths.comment));
  }
  return parts.join(" | ");
}

/** Formats warning flags shown beside a report row. */
function buildRowStatus(file: FileReport, hideCommentColumn: boolean): string {
  if (hideCommentColumn) return "";
  const flags: string[] = [];
  if (file.cognitive > THRESHOLDS.cognitive.medium) flags.push("complexity");
  if (file.security > THRESHOLDS.security.low) flags.push("security");
  if (file.commentRatio < 5) flags.push("low comments");
  if (file.commentRatio > 30) flags.push("high comments");
  return flags.length > 0 ? `⚠️  ${flags.join(", ")}` : "";
}

/** Builds one horizontal file row, including status when it fits. */
function buildRow(
  file: FileReport,
  widths: ColumnWidths,
  hideCommentColumn: boolean,
  terminalWidth: number,
): string {
  const parts = [
    padToDisplayWidth(
      truncatePath(file.relativePath, widths.file),
      widths.file,
    ),
    padToDisplayWidth(getGradeDisplay(file.grade), widths.grade),
    padToDisplayWidth(file.cognitive.toString(), widths.cognitive),
    padToDisplayWidth(file.cyclomatic.toString(), widths.cyclomatic),
    padToDisplayWidth(file.security.toString(), widths.security),
    padToDisplayWidth(file.maintainability.toString(), widths.maintain),
    padToDisplayWidth(file.cleanliness.toString(), widths.clean),
  ];
  if (!hideCommentColumn) {
    parts.push(padToDisplayWidth(`${file.commentRatio}%`, widths.comment));
  }

  const row = parts.join(" | ");
  const status = buildRowStatus(file, hideCommentColumn);
  const rowWithStatus = status ? `${row} ${status}` : row;
  return getDisplayWidth(rowWithStatus) <= terminalWidth ? rowWithStatus : row;
}

/** Prints the report as a horizontal metric table. */
function printHorizontalReport(
  report: FileReport[],
  terminalWidth: number,
  hideCommentColumn: boolean,
): void {
  const widths = getColumnWidths(terminalWidth, hideCommentColumn);
  const header = buildHeader(widths, hideCommentColumn);
  const tableWidth = getDisplayWidth(header);

  console.log("CODE QUALITY REPORT");
  console.log("=".repeat(tableWidth));
  console.log(header);
  console.log("-".repeat(tableWidth));
  for (const file of report) {
    console.log(buildRow(file, widths, hideCommentColumn, terminalWidth));
  }
  console.log("-".repeat(tableWidth));
}

/** Prints aggregate issue and scanner-error totals. */
function printSummary(report: FileReport[], totals: Totals): void {
  console.log("\n📊 SUMMARY");
  console.log(`   Files scanned: ${report.length}`);
  console.log(`   Security issues: ${totals.security}`);
  console.log(`   Maintainability issues: ${totals.maintainability}`);
  console.log(`   Cleanliness issues: ${totals.cleanliness}`);
  console.log(`   Scanner errors: ${totals.scannerErrors}`);
  if (totals.scannerErrors > 0) {
    console.log(
      "   ⚠️  Results are incomplete because one or more files could not be analyzed.",
    );
  }
}

/** Prints detailed findings grouped by file when requested. */
function printIssues(report: FileReport[], listIssues: boolean): void {
  if (!listIssues) return;
  const filesWithIssues = report.filter((file) => file.issues.length > 0);
  if (filesWithIssues.length === 0) return;

  console.log("\n📋 ISSUES:");
  for (const file of filesWithIssues) {
    console.log(`\n📂 ${file.relativePath}`);
    for (const issue of file.issues) {
      const countSuffix = issue.count > 1 ? ` (x${issue.count})` : "";
      const left = `   L${issue.line}: ${issue.message}${countSuffix}`;
      const dots = ".".repeat(Math.max(3, 55 - left.length));
      console.log(`${left} ${dots} [${issue.rule}]`);
    }
  }
}

/** Prints a non-wrapping vertical report when metric columns cannot fit. */
function printVerticalReport(
  report: FileReport[],
  terminalWidth: number,
): void {
  console.log("CODE QUALITY REPORT");
  console.log("=".repeat(Math.min(terminalWidth, 40)));

  for (const [index, file] of report.entries()) {
    const pathWidth = Math.max(1, terminalWidth - getDisplayWidth("File: "));
    console.log(`File: ${truncatePath(file.relativePath, pathWidth)}`);
    console.log(`Grade: ${getGradeDisplay(file.grade)}`);
    console.log(`Cognitive: ${file.cognitive}`);
    console.log(`Cyclomatic: ${file.cyclomatic}`);
    console.log(`Security: ${file.security}`);
    console.log(`Maintain: ${file.maintainability}`);
    console.log(`Clean: ${file.cleanliness}`);
    console.log(`Comment: ${file.commentRatio}%`);
    if (index < report.length - 1) {
      console.log("-".repeat(Math.min(terminalWidth, 40)));
    }
  }
  console.log("-".repeat(Math.min(terminalWidth, 40)));
}

/** Prints the file-level report, summary, and optional detailed findings. */
export function printReport(
  report: FileReport[],
  totals: Totals,
  options: PrintReportOptions = {},
): void {
  const terminalWidth = resolveTerminalWidth(options.terminalWidth);
  const averageCommentRatio = getAverageCommentRatio(report);
  const hideCommentColumn =
    averageCommentRatio < 5 || !canShowCommentColumn(terminalWidth);

  printDocumentationWarning(report, averageCommentRatio);
  if (canShowHorizontalTable(terminalWidth)) {
    printHorizontalReport(report, terminalWidth, hideCommentColumn);
  } else {
    printVerticalReport(report, terminalWidth);
  }
  printSummary(report, totals);
  printIssues(report, options.listIssues ?? false);
}
