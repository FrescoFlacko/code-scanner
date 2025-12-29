import path from "path";
import { parseCliArgs } from "./cli/parseCliArgs.js";
import { printHelp } from "./cli/printHelp.js";
import { getVersion } from "./cli/getVersion.js";
import { loadConfigFile } from "./config/loadConfigFile.js";
import { validateTargetPath } from "./files/validateTargetPath.js";
import { mergeExcludes } from "./files/mergeExcludes.js";
import { resolveFilesToScan } from "./files/resolveFilesToScan.js";
import { createEslintInstance } from "./eslint/createEslintInstance.js";
import { buildReport } from "./report/buildReport.js";
import { sortReport } from "./report/sortReport.js";
import { calculateTotals } from "./report/calculateTotals.js";
import { printReport } from "./report/printReport.js";
import { calculatePriorities } from "./report/calculatePriorities.js";
import { printPriorities } from "./report/printPriorities.js";
import { loadHistory } from "./history/loadHistory.js";
import { saveHistory } from "./history/saveHistory.js";
import { calculateTrends } from "./history/calculateTrends.js";
import { printTrends } from "./history/printTrends.js";
import { writeJsonOutput } from "./output/writeJsonOutput.js";
import { buildRuleCategorization, printLegend } from "../../scanner.config.js";
import { DEFAULT_PATH } from "./constants.js";
import { FileSystemError } from "./errors.js";
import type { ScanOptions, ScanResult, FileReport, Totals, ESLintResult, ScanJsonOutput, PrioritiesResult } from "./types.js";

export async function scan(options: ScanOptions = {}): Promise<ScanResult> {
  const cliArgs = options.fromCli ? parseCliArgs() : {
    targetPath: options.targetPath || DEFAULT_PATH,
    excludes: options.excludes || [],
    scanGitChanges: options.scanGitChanges || false,
    showLegend: options.showLegend || false,
    listIssues: options.listIssues || false,
    saveAsJson: options.saveAsJson || null,
    help: options.help || false,
    version: false,
  };

  if (cliArgs.version) {
    console.log(getVersion());
    return { report: [], totals: null };
  }

  if (cliArgs.help) {
    printHelp();
    return { report: [], totals: null };
  }

  const quietOutput = !!cliArgs.saveAsJson;

  const targetPath = cliArgs.targetPath === DEFAULT_PATH
    ? path.resolve(process.cwd(), DEFAULT_PATH)
    : cliArgs.targetPath;

  validateTargetPath(targetPath);

  const config = loadConfigFile(targetPath);
  const excludes = mergeExcludes(cliArgs.excludes || [], config.exclude);
  const categories = buildRuleCategorization();

  const eslint = createEslintInstance(targetPath);

  const files = await resolveFilesToScan({
    targetPath,
    excludes,
    scanGitChanges: cliArgs.scanGitChanges,
    quiet: quietOutput,
  });

  if (files.length === 0) {
    if (!quietOutput) {
      console.log(cliArgs.scanGitChanges
        ? "No modified JS/TS files found in git status.\n"
        : "No files to scan after applying exclusions.\n");
    }
    return { report: [], totals: null };
  }

  const results = await eslint.lintFiles(files) as ESLintResult[];
  const report: FileReport[] = sortReport(buildReport(results, categories, targetPath));
  const totals: Totals = calculateTotals(report);
  const priorities: PrioritiesResult = calculatePriorities(report, totals);

  const previousHistory = loadHistory(targetPath);
  const trends = calculateTrends(report, totals, previousHistory);

  if (cliArgs.saveAsJson) {
    const jsonOutput: ScanJsonOutput = {
      meta: {
        timestamp: new Date().toISOString(),
        tool: "code-scanner",
        version: getVersion(),
        targetPath,
      },
      options: {
        scanGitChanges: cliArgs.scanGitChanges,
        excludes: cliArgs.excludes || [],
      },
      totals,
      priorities,
      trends,
      report,
    };

    try {
      await writeJsonOutput(cliArgs.saveAsJson, jsonOutput);
      console.log(`✅ Saved scan results to ${cliArgs.saveAsJson}`);
    } catch (err) {
      throw new FileSystemError(`Failed to write JSON output: ${err}`);
    }

    return { report, totals, trends: trends || undefined };
  }

  printReport(report, totals, { listIssues: cliArgs.listIssues });
  printPriorities(priorities);
  printTrends(trends, previousHistory);

  saveHistory(targetPath, report, totals);

  if (cliArgs.showLegend) {
    printLegend();
  } else {
    console.log("\n💡 Run with --legend flag to see metric explanations");
  }

  return { report, totals, trends: trends || undefined };
}

export { buildRuleCategorization, categorizeRule } from "../../scanner.config.js";
export type { ScanOptions, ScanResult, FileReport, Totals, RuleCategories, CliArgs } from "./types.js";
