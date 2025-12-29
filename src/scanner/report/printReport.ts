import { THRESHOLDS } from "../../../scanner.config.js";
import { getGradeDisplay } from "../grading/calculateGrade.js";
import type { FileReport, Totals, Grade } from "../types.js";

interface PrintReportOptions {
  listIssues?: boolean;
}

export function printReport(report: FileReport[], totals: Totals, options: PrintReportOptions = {}): void {
  const { listIssues = false } = options;

  const totalCommentRatio = report.reduce((sum, r) => sum + r.commentRatio, 0);
  const avgCommentRatio = report.length > 0 ? Math.round(totalCommentRatio / report.length) : 0;
  const hideCommentColumn = avgCommentRatio < 5;

  if (hideCommentColumn && report.length > 0) {
    console.log(`⚠️  Documentation is critically missing across the project (${avgCommentRatio}% coverage).\n`);
  }

  const colWidths = { file: 25, grade: 6, num: 10 };

  const headerParts = [
    "File".padEnd(colWidths.file),
    "Grade".padEnd(colWidths.grade),
    "Cognitive".padEnd(colWidths.num),
    "Cyclomatic".padEnd(colWidths.num),
    "Security".padEnd(colWidths.num),
    "Maintain".padEnd(colWidths.num),
    "Clean".padEnd(colWidths.num),
  ];

  if (!hideCommentColumn) {
    headerParts.push("Comment %".padEnd(colWidths.num));
  }

  const header = headerParts.join(" | ");

  console.log("CODE QUALITY REPORT");
  console.log("=".repeat(header.length + 4));
  console.log(header);
  console.log("-".repeat(header.length + 4));

  report.forEach((r) => {
    const rowParts = [
      r.file.padEnd(colWidths.file),
      getGradeDisplay(r.grade).padEnd(colWidths.grade),
      r.cognitive.toString().padEnd(colWidths.num),
      r.cyclomatic.toString().padEnd(colWidths.num),
      r.security.toString().padEnd(colWidths.num),
      r.maintainability.toString().padEnd(colWidths.num),
      r.cleanliness.toString().padEnd(colWidths.num),
    ];

    if (!hideCommentColumn) {
      rowParts.push(`${r.commentRatio}%`.padEnd(colWidths.num));
    }

    const row = rowParts.join(" | ");

    let status = "";
    if (!hideCommentColumn) {
      const flags: string[] = [];
      if (r.cognitive > THRESHOLDS.cognitive.medium) flags.push("complexity");
      if (r.security > THRESHOLDS.security.low) flags.push("security");
      if (r.commentRatio < 5) flags.push("low comments");
      if (r.commentRatio > 30) flags.push("high comments");
      status = flags.length > 0 ? `⚠️  ${flags.join(", ")}` : "";
    }

    console.log(`${row} ${status}`);
  });

  console.log("-".repeat(header.length + 4));

  const gradeCount: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  report.forEach((r) => gradeCount[r.grade]++);

  console.log(`\n📊 SUMMARY`);
  console.log(`   Files scanned: ${report.length}`);
  console.log(`   Security issues: ${totals.security}`);
  console.log(`   Maintainability issues: ${totals.maintainability}`);
  console.log(`   Cleanliness issues: ${totals.cleanliness}`);

  const filesWithIssues = report.filter((r) => r.issues.length > 0);

  if (listIssues && filesWithIssues.length > 0) {
    console.log(`\n📋 ISSUES:`);

    filesWithIssues.forEach((r) => {
      console.log(`\n📂 ${r.file}`);

      r.issues.forEach((issue) => {
        const countSuffix = issue.count > 1 ? ` (x${issue.count})` : "";
        const left = `   L${issue.line}: ${issue.message}${countSuffix}`;
        const targetWidth = 55;
        const dotsNeeded = Math.max(3, targetWidth - left.length);
        const dots = ".".repeat(dotsNeeded);
        console.log(`${left} ${dots} [${issue.rule}]`);
      });
    });
  }
}
