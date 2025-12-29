import type { HistoryData } from "./loadHistory.js";
import type { Trends } from "../types.js";

export function printTrends(trends: Trends | null, previousHistory: HistoryData | null): void {
  if (!trends) {
    console.log(`\n📈 TREND ANALYSIS`);
    console.log(`   First scan - no previous data to compare.`);
    console.log(`   Run again after making changes to see trends.`);
    return;
  }

  console.log(`\n📈 TREND ANALYSIS (compared to ${new Date(previousHistory!.timestamp).toLocaleString()})`);

  const { totals } = trends;

  if (totals.security < 0) {
    console.log(`   📉 Security issues decreased by ${Math.abs(totals.security)} (Good job!)`);
  } else if (totals.security > 0) {
    console.log(`   🔺 Security issues increased by ${totals.security}`);
  }

  if (totals.avgCognitive < -1) {
    const pct = Math.abs(Math.round((totals.avgCognitive / (previousHistory!.totals.avgCognitive || 1)) * 100));
    console.log(`   📉 Avg Cognitive Complexity improved by ${pct}% (Good job!)`);
  } else if (totals.avgCognitive > 1) {
    const pct = Math.round((totals.avgCognitive / (previousHistory!.totals.avgCognitive || 1)) * 100);
    console.log(`   🔺 Avg Cognitive Complexity increased by ${pct}%`);
  }

  if (totals.maintainability < 0) {
    console.log(`   📉 Maintainability issues decreased by ${Math.abs(totals.maintainability)}`);
  } else if (totals.maintainability > 0) {
    console.log(`   🔺 Maintainability issues increased by ${totals.maintainability}`);
  }

  if (totals.cleanliness < 0) {
    console.log(`   📉 Cleanliness issues decreased by ${Math.abs(totals.cleanliness)}`);
  } else if (totals.cleanliness > 0) {
    console.log(`   🔺 Cleanliness issues increased by ${totals.cleanliness}`);
  }

  if (trends.regressed.length > 0) {
    console.log(`\n   ⚠️  Files that regressed:`);
    trends.regressed.slice(0, 5).forEach((r) => {
      const details: string[] = [];
      if (r.cognitive > 0) details.push(`cognitive +${r.cognitive}`);
      if (r.security > 0) details.push(`security +${r.security}`);
      if (r.maintainability !== undefined && r.maintainability > 5) details.push(`maintainability +${r.maintainability}`);
      console.log(`      ${r.file} (${details.join(", ")})`);
    });
    if (trends.regressed.length > 5) {
      console.log(`      ... and ${trends.regressed.length - 5} more`);
    }
  }

  if (trends.improved.length > 0) {
    console.log(`\n   ✅ Files that improved:`);
    trends.improved.slice(0, 5).forEach((r) => {
      const details: string[] = [];
      if (r.cognitive < 0) details.push(`cognitive ${r.cognitive}`);
      if (r.security < 0) details.push(`security ${r.security}`);
      console.log(`      ${r.file} (${details.join(", ")})`);
    });
    if (trends.improved.length > 5) {
      console.log(`      ... and ${trends.improved.length - 5} more`);
    }
  }

  if (trends.new.length > 0) {
    console.log(`\n   🆕 New files: ${trends.new.length}`);
  }

  if (trends.removed.length > 0) {
    console.log(`   🗑️  Removed files: ${trends.removed.length}`);
  }

  if (totals.security === 0 && totals.avgCognitive <= 1 && totals.avgCognitive >= -1 && 
      totals.maintainability === 0 && totals.cleanliness === 0) {
    console.log(`   ➡️  No significant changes since last scan.`);
  }
}
