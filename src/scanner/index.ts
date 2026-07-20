import path from "path";
import {
  buildAngularTemplateRules,
  printLegend,
  resolveRuleConfiguration,
  RULE_MANIFEST,
} from "../../scanner.config.js";
import { parseCliArgs } from "./cli/parseCliArgs.js";
import { printHelp } from "./cli/printHelp.js";
import { getVersion } from "./cli/getVersion.js";
import { loadConfigFile } from "./config/loadConfigFile.js";
import { DEFAULT_PATH } from "./constants.js";
import { createEslintInstance } from "./eslint/createEslintInstance.js";
import { FileSystemError } from "./errors.js";
import { mergeExcludes } from "./files/mergeExcludes.js";
import {
  DEFAULT_EXCLUDES,
  resolveFilesToScan,
} from "./files/resolveFilesToScan.js";
import { validateTargetPath } from "./files/validateTargetPath.js";
import { calculateTrends } from "./history/calculateTrends.js";
import { createConfigurationFingerprint } from "./history/createConfigurationFingerprint.js";
import { loadHistory, type HistoryData } from "./history/loadHistory.js";
import { printTrends } from "./history/printTrends.js";
import { saveHistory } from "./history/saveHistory.js";
import { writeJsonOutput } from "./output/writeJsonOutput.js";
import { buildReport } from "./report/buildReport.js";
import { calculatePriorities } from "./report/calculatePriorities.js";
import { calculateTotals } from "./report/calculateTotals.js";
import { printPriorities } from "./report/printPriorities.js";
import { printReport } from "./report/printReport.js";
import { sortReport } from "./report/sortReport.js";
import type {
  CliArgs,
  ESLintResult,
  FileReport,
  PrioritiesResult,
  ScanJsonOutput,
  ScanOptions,
  ScanResult,
  Totals,
  Trends,
} from "./types.js";

interface HistoryState {
  enabled: boolean;
  previous: HistoryData | null;
  trends: Trends | null;
}

/** Resolves programmatic options or arguments supplied to the CLI process. */
function resolveArguments(options: ScanOptions): CliArgs {
  if (options.fromCli) return parseCliArgs();
  return {
    targetPath: options.targetPath || DEFAULT_PATH,
    excludes: options.excludes || [],
    scanGitChanges: options.scanGitChanges || false,
    showLegend: options.showLegend || false,
    listIssues: options.listIssues || false,
    saveAsJson: options.saveAsJson || null,
    help: options.help || false,
    version: false,
    profiles: options.profiles || [],
  };
}

/** Handles CLI requests that do not perform a scan. */
function handleInformationalRequest(cliArgs: CliArgs): ScanResult | null {
  if (cliArgs.version) {
    console.log(getVersion());
    return { report: [], totals: null };
  }
  if (cliArgs.help) {
    printHelp();
    return { report: [], totals: null };
  }
  return null;
}

/** Resolves the default scan directory without changing explicit paths. */
function resolveTargetPath(targetPath: string): string {
  return targetPath === DEFAULT_PATH
    ? path.resolve(process.cwd(), DEFAULT_PATH)
    : targetPath;
}

/** Prints the appropriate empty-scan message and returns an empty result. */
function handleEmptyScan(
  files: string[],
  cliArgs: CliArgs,
  quietOutput: boolean,
): ScanResult | null {
  if (files.length > 0 || cliArgs.saveAsJson) return null;
  if (!quietOutput) {
    console.log(
      cliArgs.scanGitChanges
        ? "No modified JS/TS files found in git status.\n"
        : "No files to scan after applying exclusions.\n",
    );
  }
  return { report: [], totals: null };
}

/** Loads compatible project history and calculates comparable trends. */
function createHistoryState(
  targetPath: string,
  cliArgs: CliArgs,
  options: ScanOptions,
  configurationFingerprint: string,
  report: FileReport[],
  totals: Totals,
): HistoryState {
  const enabled = !cliArgs.scanGitChanges && options.persistHistory !== false;
  const loaded = enabled ? loadHistory(targetPath) : null;
  const previous =
    loaded?.configurationFingerprint === configurationFingerprint
      ? loaded
      : null;
  return {
    enabled,
    previous,
    trends: enabled ? calculateTrends(report, totals, previous) : null,
  };
}

/** Builds the stable JSON contract for a completed scan. */
function buildJsonOutput(
  targetPath: string,
  cliArgs: CliArgs,
  excludes: string[],
  profiles: CliArgs["profiles"],
  effectiveRules: number,
  configurationFingerprint: string,
  report: FileReport[],
  totals: Totals,
  priorities: PrioritiesResult,
  trends: Trends | null,
): ScanJsonOutput {
  return {
    meta: {
      timestamp: new Date().toISOString(),
      tool: "code-scanner",
      version: getVersion(),
      targetPath,
      configurationVersion: RULE_MANIFEST.schemaVersion,
      configurationFingerprint,
      pluginVersions: { ...RULE_MANIFEST.plugins },
    },
    options: {
      scanGitChanges: cliArgs.scanGitChanges,
      excludes,
      profiles,
      effectiveRules,
    },
    totals,
    priorities,
    trends,
    report,
  };
}

/** Writes JSON output and returns the corresponding programmatic result. */
async function saveJsonResult(
  outputPath: string,
  jsonOutput: ScanJsonOutput,
): Promise<ScanResult> {
  try {
    await writeJsonOutput(outputPath, jsonOutput);
    console.log(`✅ Saved scan results to ${outputPath}`);
  } catch (error) {
    throw new FileSystemError(`Failed to write JSON output: ${error}`);
  }
  return {
    report: jsonOutput.report,
    totals: jsonOutput.totals,
    trends: jsonOutput.trends || undefined,
  };
}

/** Prints the human-readable report, priorities, trends, and optional legend. */
function printScanResult(
  cliArgs: CliArgs,
  report: FileReport[],
  totals: Totals,
  priorities: PrioritiesResult,
  history: HistoryState,
): void {
  printReport(report, totals, { listIssues: cliArgs.listIssues });
  printPriorities(priorities);
  if (cliArgs.scanGitChanges) {
    console.log(
      "\n📈 TREND ANALYSIS\n   Skipped for partial Git-change scan; full-project history was preserved.",
    );
  } else {
    printTrends(history.trends, history.previous);
  }
  if (cliArgs.showLegend) printLegend();
  else console.log("\n💡 Run with --legend flag to see metric explanations");
}

/** Persists a full-project scan when history tracking is enabled. */
function persistHistory(
  history: HistoryState,
  targetPath: string,
  report: FileReport[],
  totals: Totals,
  configurationFingerprint: string,
  profiles: CliArgs["profiles"],
): void {
  if (!history.enabled) return;
  saveHistory(
    targetPath,
    report,
    totals,
    configurationFingerprint,
    profiles,
    RULE_MANIFEST.schemaVersion,
  );
}

/** Scans a project and returns its report, totals, and optional trends. */
export async function scan(options: ScanOptions = {}): Promise<ScanResult> {
  const cliArgs = resolveArguments(options);
  const informationalResult = handleInformationalRequest(cliArgs);
  if (informationalResult) return informationalResult;

  const quietOutput =
    Boolean(cliArgs.saveAsJson) || (!options.fromCli && options.quiet === true);
  const targetPath = resolveTargetPath(cliArgs.targetPath);
  validateTargetPath(targetPath);

  const config = loadConfigFile(targetPath);
  const excludes = mergeExcludes(cliArgs.excludes, config.exclude);
  const requestedProfiles = [
    ...new Set([...config.profiles, ...cliArgs.profiles]),
  ];
  const resolved = resolveRuleConfiguration(requestedProfiles, config.rules);
  const configurationFingerprint = createConfigurationFingerprint({
    schemaVersion: RULE_MANIFEST.schemaVersion,
    profiles: resolved.profiles,
    rules: {
      ...resolved.rules,
      ...buildAngularTemplateRules(resolved.profiles, config.rules),
    },
    excludes: [...DEFAULT_EXCLUDES, ...excludes],
    pluginVersions: RULE_MANIFEST.plugins,
  });
  const eslint = createEslintInstance(
    targetPath,
    requestedProfiles,
    config.rules,
  );
  const files = await resolveFilesToScan({
    targetPath,
    excludes,
    scanGitChanges: cliArgs.scanGitChanges,
    quiet: quietOutput,
    includeHtml: resolved.profiles.includes("angular"),
  });
  const emptyResult = handleEmptyScan(files, cliArgs, quietOutput);
  if (emptyResult) return emptyResult;

  const eslintResults: ESLintResult[] =
    files.length === 0 ? [] : await eslint.lintFiles(files);
  const report = sortReport(
    buildReport(eslintResults, resolved.categories, targetPath),
  );
  const totals = calculateTotals(report);
  const priorities = calculatePriorities(report, totals);
  const history = createHistoryState(
    targetPath,
    cliArgs,
    options,
    configurationFingerprint,
    report,
    totals,
  );

  if (cliArgs.saveAsJson) {
    const jsonOutput = buildJsonOutput(
      targetPath,
      cliArgs,
      excludes,
      resolved.profiles,
      resolved.effectiveRuleCount,
      configurationFingerprint,
      report,
      totals,
      priorities,
      history.trends,
    );
    return saveJsonResult(cliArgs.saveAsJson, jsonOutput);
  }

  if (!quietOutput) {
    printScanResult(cliArgs, report, totals, priorities, history);
  }
  persistHistory(
    history,
    targetPath,
    report,
    totals,
    configurationFingerprint,
    resolved.profiles,
  );
  return { report, totals, trends: history.trends || undefined };
}

export {
  buildRuleCategorization,
  categorizeRule,
} from "../../scanner.config.js";
export type {
  CliArgs,
  FileReport,
  RuleCategories,
  ScanOptions,
  ScanResult,
  Totals,
} from "./types.js";
