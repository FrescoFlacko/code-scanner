export function buildScanPattern(includeHtml = false): string {
  return includeHtml
    ? "**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,html}"
    : "**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}";
}
