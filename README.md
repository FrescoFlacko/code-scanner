# code-scanner

A code quality scanning tool built on ESLint. It scans JavaScript/TypeScript source files and produces a report focused on complexity and issue categorization.

## What it does

`code-scanner` runs ESLint across your project’s JS/TS files and summarizes results into:

- Per-file code quality table
  - Grade (A–F)
  - Cognitive Complexity
  - Cyclomatic Complexity
  - Issue counts by category: security, maintainability, cleanliness
  - Comment ratio (shown when meaningful)
- A summary section (totals and counts)
- Top priority files to fix (impact-oriented)
- Trend analysis compared to the previous scan (when history is available)

It scans files matching:

- `**/*.{js,ts,jsx,tsx}`

## Requirements

- Node.js >= 20

## Install (from source)

```bash
npm install
```

## Build

```bash
npm run build
```

Other useful scripts:

```bash
npm run typecheck
npm test
npm run clean
```

## Usage

This repo’s CLI entrypoint (`bin/scanner.js`) runs the built output (`dist/...`), so build first:

```bash
npm run build
node bin/scanner.js --help
```

You can also run the default scan via:

```bash
npm run scan
```

### CLI

```text
code-scanner [path] [options]
```

- `path`: Directory or file to scan (default: `./src`)

### Options

- `--list-issues`
  - Show a detailed list of all issues per file (rule, message, line).
- `--save-as-json <file>`
  - Export the full scan result to JSON.
  - Suppresses the normal console report output.
- `--scan-git-changes`
  - Only scan files reported as changed by `git status --porcelain`.
- `--exclude, -e <pattern>`
  - Exclude files matching a glob pattern. Can be provided multiple times.
  - Examples: `"*.test.ts"`, `"**/node_modules/**"`, `"src/generated/*"`
- `--legend`
  - Print metric explanations after the report.
- `--version, -v`
  - Print the tool version.
- `--help, -h`
  - Print help.

### Examples

Scan the default `./src` directory:

```bash
npm run build
node bin/scanner.js
```

Scan a specific directory:

```bash
npm run build
node bin/scanner.js ./lib
```

Scan and show all issues:

```bash
npm run build
node bin/scanner.js --list-issues
```

Export results to JSON:

```bash
npm run build
node bin/scanner.js --save-as-json report.json
```

Scan only git-changed files:

```bash
npm run build
node bin/scanner.js --scan-git-changes
```

Exclude test files:

```bash
npm run build
node bin/scanner.js --exclude "*.test.ts" --exclude "*.spec.ts"
```

## Configuration (.scannerrc.json)

`code-scanner` optionally reads a JSON config file named `.scannerrc.json` from the scan target directory.

Example:

```json
{
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.ts"
  ]
}
```

Notes:

- If `.scannerrc.json` is missing, defaults are used.
- If it exists but contains invalid JSON, it is ignored and a warning is printed.
- CLI excludes (`--exclude/-e`) are merged with config excludes.

## Output

By default, the scanner prints:

- A code quality table with grades and metrics per file
- Summary totals (security, maintainability, cleanliness)
- Top 3 priority files to fix
- Trend analysis (compared to the previous scan)

Use `--legend` to see detailed explanations of the reported metrics.

## JSON output

When using `--save-as-json <file>`, the output contains:

- `meta`: timestamp, tool name, version, targetPath
- `options`: scanGitChanges, excludes
- `totals`: aggregated counts/averages
- `priorities`: prioritized files and overall improvement estimate
- `trends`: trend summary (or `null`)
- `report`: per-file results including issue detail

## History and trends

In normal (console) mode, the scanner saves a lightweight history file to the scan target directory:

- `.scanner-history.json`

On subsequent runs, this is used to compute and print trend information.

Note: when running with `--save-as-json`, the scanner does not write `.scanner-history.json` (it exits after writing the JSON output).

## Exit codes

- `0`: Success
- `2`: User error (invalid CLI arguments)
- `1`: Scanner error or unexpected error

## Programmatic usage

The scanner can also be used as a library via the exported `scan` function:

```ts
import { scan } from "code-scanner";

const result = await scan({
  targetPath: "./src",
  excludes: ["**/*.test.ts"],
  scanGitChanges: false,
  showLegend: false,
  listIssues: false,
  saveAsJson: null,
});

console.log(result.totals);
```
