export function buildScanPattern(targetPath: string): string {
  const normalizedPath = targetPath.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalizedPath}/**/*.{js,ts,jsx,tsx}`;
}
