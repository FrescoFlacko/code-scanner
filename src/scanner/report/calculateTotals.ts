import type { FileReport, Totals } from "../types.js";

export function calculateTotals(report: FileReport[]): Totals {
  let totalSecurity = 0;
  let totalMaintainability = 0;
  let totalCleanliness = 0;
  let totalCognitive = 0;
  let totalCyclomatic = 0;

  report.forEach((r) => {
    totalSecurity += r.security;
    totalMaintainability += r.maintainability;
    totalCleanliness += r.cleanliness;
    totalCognitive += r.cognitive;
    totalCyclomatic += r.cyclomatic;
  });

  const avgCognitive = report.length > 0 ? Math.round((totalCognitive / report.length) * 10) / 10 : 0;
  const avgCyclomatic = report.length > 0 ? Math.round((totalCyclomatic / report.length) * 10) / 10 : 0;

  return {
    security: totalSecurity,
    maintainability: totalMaintainability,
    cleanliness: totalCleanliness,
    avgCognitive,
    avgCyclomatic,
  };
}
