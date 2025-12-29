import type { FileReport } from "../types.js";

export function sortReport(report: FileReport[]): FileReport[] {
  return [...report].sort((a, b) => {
    if (b.security !== a.security) return b.security - a.security;
    if (b.cognitive !== a.cognitive) return b.cognitive - a.cognitive;
    return b.maintainability - a.maintainability;
  });
}
