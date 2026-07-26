import type { FileTrendInfo, Trends } from "../types.js";
import type { HistoryData } from "./loadHistory.js";

type TrendDirection = "improved" | "regressed";
type CountMetric = Exclude<keyof FileTrendInfo, "file" | "commentRatio" | "commentRatioQuality">;

const COUNT_METRICS: Array<{ key: CountMetric; label: string }> = [
  { key: "cognitive", label: "cognitive" },
  { key: "cyclomatic", label: "cyclomatic" },
  { key: "security", label: "security" },
  { key: "maintainability", label: "maintainability" },
  { key: "cleanliness", label: "cleanliness" },
  { key: "scannerErrors", label: "scanner errors" },
];

/** Prints a metric change with different decrease and increase messages. */
function printCountChange(
  value: number,
  decreaseMessage: string,
  increaseMessage: string,
  decreaseSuffix = "",
  increaseSuffix = "",
): void {
  if (value < 0) {
    console.log(`${decreaseMessage}${Math.abs(value)}${decreaseSuffix}`);
  } else if (value > 0) {
    console.log(`${increaseMessage}${value}${increaseSuffix}`);
  }
}

/** Prints the percentage change in average cognitive complexity. */
function printCognitiveChange(value: number, previousAverage: number): void {
  if (value < -1) {
    const percentage = Math.abs(Math.round((value / (previousAverage || 1)) * 100));
    console.log(`   📉 Avg Cognitive Complexity improved by ${percentage}% (Good job!)`);
  } else if (value > 1) {
    const percentage = Math.round((value / (previousAverage || 1)) * 100);
    console.log(`   🔺 Avg Cognitive Complexity increased by ${percentage}%`);
  }
}

/** Prints all project-level trend deltas. */
function printTotalChanges(trends: Trends, previousHistory: HistoryData): void {
  const { totals } = trends;
  printCountChange(
    totals.scannerErrors,
    "   ✅ Scanner errors decreased by ",
    "   ⚠️  Scanner errors increased by ",
    "",
    "; trend data may be incomplete",
  );
  printCountChange(
    totals.security,
    "   📉 Security issues decreased by ",
    "   🔺 Security issues increased by ",
    " (Good job!)",
  );
  printCognitiveChange(totals.avgCognitive, previousHistory.totals.avgCognitive);
  printCountChange(
    totals.maintainability,
    "   📉 Maintainability issues decreased by ",
    "   🔺 Maintainability issues increased by ",
  );
  printCountChange(
    totals.cleanliness,
    "   📉 Cleanliness issues decreased by ",
    "   🔺 Cleanliness issues increased by ",
  );
}

/** Determines whether a signed metric belongs in a trend direction. */
function matchesDirection(value: number, direction: TrendDirection): boolean {
  return direction === "improved" ? value < 0 : value > 0;
}

/** Determines whether a quality-score change belongs in a trend direction. */
function matchesQualityDirection(value: number, direction: TrendDirection): boolean {
  return direction === "improved" ? value > 0 : value < 0;
}

/** Formats the metric details for one changed file. */
function formatFileTrend(trend: FileTrendInfo, direction: TrendDirection): string {
  const details: string[] = [];
  for (const metric of COUNT_METRICS) {
    const value = trend[metric.key];
    if (matchesDirection(value, direction)) {
      details.push(`${metric.label} ${value > 0 ? "+" : ""}${value}`);
    }
  }
  if (matchesQualityDirection(trend.commentRatioQuality, direction)) {
    const sign = trend.commentRatio > 0 ? "+" : "";
    details.push(`comment ratio ${sign}${trend.commentRatio.toFixed(3)}`);
  }
  return details.join(", ");
}

/** Prints at most five changed files for one trend direction. */
function printFileTrends(trends: FileTrendInfo[], direction: TrendDirection): void {
  if (trends.length === 0) return;
  const heading =
    direction === "improved" ? "\n   ✅ Files that improved:" : "\n   ⚠️  Files that regressed:";
  console.log(heading);
  for (const trend of trends.slice(0, 5)) {
    console.log(`      ${trend.file} (${formatFileTrend(trend, direction)})`);
  }
  if (trends.length > 5) {
    console.log(`      ... and ${trends.length - 5} more`);
  }
}

/** Returns whether the project-level metrics are effectively unchanged. */
function hasNoSignificantChange(trends: Trends): boolean {
  const { avgCognitive, ...exactTotals } = trends.totals;
  const changedFileCount =
    trends.improved.length + trends.regressed.length + trends.new.length + trends.removed.length;
  return (
    Object.values(exactTotals).every((value) => value === 0) &&
    Math.abs(avgCognitive) <= 1 &&
    changedFileCount === 0
  );
}

/** Prints trend comparisons against a previous compatible scan. */
export function printTrends(trends: Trends | null, previousHistory: HistoryData | null): void {
  if (!trends || !previousHistory) {
    console.log("\n📈 TREND ANALYSIS");
    console.log("   First scan - no previous data to compare.");
    console.log("   Run again after making changes to see trends.");
    return;
  }

  console.log(
    `\n📈 TREND ANALYSIS (compared to ${new Date(previousHistory.timestamp).toLocaleString()})`,
  );
  printTotalChanges(trends, previousHistory);
  printFileTrends(trends.regressed, "regressed");
  printFileTrends(trends.improved, "improved");
  if (trends.new.length > 0) {
    console.log(`\n   🆕 New files: ${trends.new.length}`);
  }
  if (trends.removed.length > 0) {
    console.log(`   🗑️  Removed files: ${trends.removed.length}`);
  }
  if (hasNoSignificantChange(trends)) {
    console.log("   ➡️  No significant changes since last scan.");
  }
}
