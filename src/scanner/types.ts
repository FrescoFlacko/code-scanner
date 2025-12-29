import type { Linter } from "eslint";

export type Grade = "A" | "B" | "C" | "D" | "F";

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
  commentRatio: number;
  grade: Grade;
  issues: Issue[];
}

export interface Totals {
  security: number;
  maintainability: number;
  cleanliness: number;
  avgCognitive: number;
  avgCyclomatic: number;
}

export interface FileTrendInfo {
  file: string;
  cognitive: number;
  security: number;
  maintainability?: number;
}

export interface Trends {
  totals: {
    security: number;
    maintainability: number;
    cleanliness: number;
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
}

export interface HistoryEntry {
  timestamp: string;
  totals: Totals;
  fileCount: number;
}

export interface ScannerConfig {
  exclude: string[];
}

// ESLint result types (simplified from ESLint's types)
export interface ESLintResult {
  filePath: string;
  messages: Linter.LintMessage[];
  errorCount: number;
  warningCount: number;
}

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
  };
  options: {
    scanGitChanges: boolean;
    excludes: string[];
  };
  totals: Totals;
  priorities: PrioritiesResult;
  trends: Trends | null;
  report: FileReport[];
}
