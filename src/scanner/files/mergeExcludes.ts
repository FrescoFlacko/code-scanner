export function mergeExcludes(cliExcludes: string[], configExcludes: string[]): string[] {
  return [...new Set([...cliExcludes, ...configExcludes])];
}
