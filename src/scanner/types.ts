import type { ESLint } from "eslint";

export type Grade = "A" | "B" | "C" | "D" | "F";
export const PROFILE_NAMES = [
  "generic",
  "typed",
  "node",
  "browser",
  "react",
  "lambda",
  "angular",
  "strict",
] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

export interface Issue {
  rule: string;
  category: "security" | "maintainability" | "cleanliness" | "other";
  line: number;
  message: string;
  count: number;
}

export interface FileReport {
  file: string;
  relativePath: string;
  cognitive: number;
  cyclomatic: number;
  security: number;
  maintainability: number;
  cleanliness: number;
  /** Fatal parser or scanner-configuration errors that prevented complete analysis. */
  scannerErrors: number;
  commentRatio: number;
  grade: Grade;
  issues: Issue[];
}

export interface Totals {
  security: number;
  maintainability: number;
  cleanliness: number;
  /** Operational failures are separate from code-quality findings. */
  scannerErrors: number;
  avgCognitive: number;
  avgCyclomatic: number;
}

export interface FileTrendInfo {
  file: string;
  cognitive: number;
  cyclomatic: number;
  security: number;
  maintainability: number;
  cleanliness: number;
  scannerErrors: number;
  commentRatio: number;
  /** Signed change in the comment-ratio grading score. */
  commentRatioQuality: number;
}

export interface Trends {
  totals: {
    security: number;
    maintainability: number;
    cleanliness: number;
    scannerErrors: number;
    avgCognitive: number;
    avgCyclomatic: number;
    files: number;
  };
  improved: FileTrendInfo[];
  regressed: FileTrendInfo[];
  new: string[];
  removed: string[];
}

export interface CliArgs {
  targetPath: string;
  excludes: string[];
  scanGitChanges: boolean;
  showLegend: boolean;
  listIssues: boolean;
  saveAsJson: string | null;
  help: boolean;
  version: boolean;
  profiles: ProfileName[];
}

export interface ScanOptions {
  fromCli?: boolean;
  targetPath?: string;
  excludes?: string[];
  scanGitChanges?: boolean;
  showLegend?: boolean;
  listIssues?: boolean;
  saveAsJson?: string | null;
  help?: boolean;
  /** Suppress console presentation when using the programmatic API. */
  quiet?: boolean;
  /** Read and update trend history. Defaults to true for full scans. */
  persistHistory?: boolean;
  profiles?: ProfileName[];
}

export interface ScanResult {
  report: FileReport[];
  totals: Totals | null;
  trends?: Trends;
}

export interface RuleCategories {
  security: string[];
  maintainability: string[];
  cleanliness: string[];
  metrics: string[];
}

export interface HistoryEntry {
  timestamp: string;
  totals: Totals;
  fileCount: number;
}

export interface ScannerConfig {
  exclude: string[];
  profiles: ProfileName[];
  rules: Record<string, unknown>;
}

export type ESLintResult = ESLint.LintResult;

export interface ThresholdLevel {
  low: number;
  medium: number;
  high: number;
}

export interface Thresholds {
  cognitive: ThresholdLevel;
  cyclomatic: ThresholdLevel;
  security: ThresholdLevel;
  maintainability: ThresholdLevel;
  cleanliness: ThresholdLevel;
}

export interface LegendInterpretation {
  [range: string]: string;
}

export interface LegendEntry {
  name: string;
  description: string;
  interpretation: LegendInterpretation;
  examples?: string[];
}

export interface Legend {
  cognitive: LegendEntry;
  cyclomatic: LegendEntry;
  security: LegendEntry;
  maintainability: LegendEntry;
  cleanliness: LegendEntry;
  commentRatio: LegendEntry;
}

export interface PriorityImpact {
  scannerErrorReduction: number;
  scannerErrorPercentage: number;
  securityReduction: number;
  securityPercentage: number;
  maintainabilityReduction: number;
  maintainabilityPercentage: number;
  cleanlinessReduction: number;
  cleanlinessPercentage: number;
}

export interface PriorityItem {
  file: string;
  relativePath: string;
  currentGrade: Grade;
  projectedGrade: Grade;
  primaryReason: string;
  impact: PriorityImpact;
  score: number;
}

export interface PrioritiesResult {
  items: PriorityItem[];
  overallImprovementPct: number;
}

export interface ScanJsonOutput {
  meta: {
    timestamp: string;
    tool: string;
    version: string;
    targetPath: string;
    configurationVersion: number;
    configurationFingerprint: string;
    pluginVersions: Record<string, string>;
  };
  options: {
    scanGitChanges: boolean;
    excludes: string[];
    profiles: ProfileName[];
    effectiveRules: number;
  };
  totals: Totals;
  priorities: PrioritiesResult;
  trends: Trends | null;
  report: FileReport[];
}
