import { getGradeDisplay } from "../grading/calculateGrade.js";
import type { PrioritiesResult } from "../types.js";

export function printPriorities(priorities: PrioritiesResult): void {
  if (priorities.items.length === 0) {
    return;
  }

  const allGradeA = priorities.items.every((item) => item.currentGrade === "A");
  if (allGradeA) {
    console.log(`\n🎉 TOP FILES - All scanned files have excellent grades!`);
    return;
  }

  console.log(
    `\n🔥 TOP 3 PRIORITIES (Fix these to improve overall score by ~${priorities.overallImprovementPct}%)`
  );

  priorities.items.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.file} (${item.primaryReason})`);

    const impactLines: string[] = [];

    if (item.impact.securityReduction > 0) {
      impactLines.push(
        `Would reduce security issues by ${item.impact.securityReduction} (${item.impact.securityPercentage}% of total)`
      );
    }

    if (item.impact.maintainabilityReduction > 0) {
      impactLines.push(
        `Would reduce maintainability issues by ${item.impact.maintainabilityReduction} (${item.impact.maintainabilityPercentage}% of total)`
      );
    }

    if (item.impact.cleanlinessReduction > 0) {
      impactLines.push(
        `Would reduce cleanliness issues by ${item.impact.cleanlinessReduction} (${item.impact.cleanlinessPercentage}% of total)`
      );
    }

    if (item.currentGrade !== item.projectedGrade) {
      const currentDisplay = getGradeDisplay(item.currentGrade);
      const projectedDisplay = getGradeDisplay(item.projectedGrade);
      impactLines.push(`Could raise grade from ${currentDisplay} → ${projectedDisplay}`);
    }

    impactLines.forEach((line) => {
      console.log(`   └─ ${line}`);
    });
  });
}
