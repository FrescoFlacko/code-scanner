import micromatch from "micromatch";

export function matchesExcludePattern(relativePath: string, excludePatterns: string[]): boolean {
  if (excludePatterns.length === 0) return false;
  return micromatch.isMatch(relativePath, excludePatterns, { dot: true });
}
