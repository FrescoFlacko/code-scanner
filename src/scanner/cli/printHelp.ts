export function printHelp(): void {
  const help = `
code-scanner - A code quality scanning tool built on ESLint

USAGE
  code-scanner [path] [options]

ARGUMENTS
  path                    Directory to scan (default: ./src)

OPTIONS
  --list-issues           Show detailed list of all issues per file
  --save-as-json <file>   Export results to JSON file (suppresses console output)
  --scan-git-changes      Only scan files modified in git
  --exclude, -e <pattern> Exclude files matching glob pattern (can be used multiple times)
                          Examples: "*.test.ts", "**/node_modules/**", "src/generated/*"
  --profile, -p <name>    Add a profile: generic, typed, node, browser, react, lambda, angular, strict
  --legend                Show metric explanations after the report
  --version, -v           Show version number
  --help, -h              Show this help message

EXAMPLES
  # Scan the default ./src directory
  code-scanner

  # Scan a specific directory
  code-scanner ./lib

  # Scan and show all issues
  code-scanner --list-issues

  # Export results to JSON
  code-scanner --save-as-json report.json

  # Scan only git-changed files
  code-scanner --scan-git-changes

  # Exclude test files
  code-scanner --exclude "*.test.ts" --exclude "*.spec.ts"

  # Combine multiple options
  code-scanner ./src --list-issues --exclude node_modules --legend

OUTPUT
  By default, the scanner outputs:
  • Code quality table with grades and metrics per file
  • Summary totals (security, maintainability, cleanliness issues)
  • Top 3 priority files to fix
  • Trend analysis (compared to previous scan)

  Use --list-issues to also see detailed issues per file.
  Use --save-as-json to export all data including issues to a JSON file.

GRADES
  🟢 A  Excellent - Well-maintained, clean code
  🟡 B  Good - Minor improvements possible
  🟠 C  Acceptable - Needs attention
  🔴 D  Poor - Significant issues to address
  ⛔ F  Failing - Critical issues require immediate attention

For more information, run with --legend to see metric explanations.
`;

  console.log(help.trim());
}
