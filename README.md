# code-scanner

A code quality scanning tool built on ESLint. It scans JavaScript/TypeScript source files and produces a report focused on complexity and issue categorization.

See [CHANGELOG.md](./CHANGELOG.md) for release changes.

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

- Node.js 22.13 or newer in the 22.x release line, or Node.js 24 and newer

## Install (from source)

```bash
npm install
```

## Global install

Install from the repo root with npm:

```bash
npm install -g .
```

The package now builds automatically during packaging, so you do not need to run `npm run build` first.

## Build

```bash
npm run build
```

Other useful scripts:

```bash
npm run check
npm run format
npm run format:check
npm run lint
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

After a global install, you can run it directly:

```bash
code-scanner --help
```

### CLI

```text
code-scanner [path] [options]
```

- `path`: Directory to scan (default: `./src`)

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
- `--profile, -p <name>`
  - Adds an explicit profile. May be repeated.
  - Available profiles: `generic` (always included), `typed`, `node`, `browser`, `react`, `lambda`, `angular`, and `strict`.
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
  "exclude": ["**/node_modules/**", "**/dist/**", "**/*.test.ts"],
  "profiles": ["angular"],
  "rules": {
    "sonarjs/no-duplicate-string": ["warn", { "threshold": 5 }]
  }
}
```

Notes:

- If `.scannerrc.json` is missing, defaults are used.
- If it exists but contains invalid JSON, it is ignored and a warning is printed.
- CLI excludes (`--exclude/-e`) are merged with config excludes.
- Profiles are explicit: project detection never silently changes the rule set.
- Metric probes collect complexity values but are not counted as rule violations.

### General JavaScript/TypeScript profiles

The always-on `generic` profile combines ESLint's recommended correctness rules, the scanner's curated SonarJS and security checks, and the recommended non-type-aware TypeScript rules. It supports `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, and `.tsx`. Generated sources and tests use lighter scopes to avoid type-service and generated-code noise.

Add only the profiles that describe the repository:

- `typed` enables type-aware TypeScript reliability checks, including unhandled promises and unsafe async usage. Production TypeScript must be included by a reachable `tsconfig.json`.
- `node` defines Node.js runtime globals such as `process`, `Buffer`, and `__dirname`.
- `browser` defines browser globals such as `window`, `document`, and `fetch`.
- `react` defines browser globals and enables the official React Hooks recommended rules for JSX/TSX and related source files.
- `strict` adds higher-noise consistency and duplication checks for teams that want a stricter gate.

For example, a typed React frontend typically uses `--profile typed --profile browser --profile react`; a general Node service typically uses `--profile typed --profile node`.

### Angular profile behavior

The `angular` profile uses the closest project `tsconfig.json` through the TypeScript project service for production TypeScript files. It adds:

- Angular lifecycle, signal, subscription, output, injectable, and metadata checks
- Type-aware promise, unsafe-value, exhaustiveness, assertion, and unused-variable checks
- Angular sanitization-bypass, dynamic-template, clear-text protocol, DOMPurify, and `postMessage` security checks
- Review-required checks for direct DOM HTML sinks, disabling Angular XSRF protection, and credential-like browser storage keys
- External and inline template correctness, accessibility, button-type, image, tracking, duplicate-attribute, and bounded-complexity checks

Spec files use a lighter non-type-aware correctness/cleanliness configuration. Files under `generated/`, `generated-api/`, or matching `*.generated.ts` are scanned as files but do not produce quality findings.

### Lambda profile behavior

The `lambda` profile applies type-aware analysis to production TypeScript and keeps specs/generated files in lighter scopes. In addition to generic and AWS security rules, it checks:

- Floating/misused promises, unsafe typed values, exhaustive switches, unnecessary assertions, and unused variables
- AWS service clients constructed inside handlers instead of reusable module scope
- Async handlers that also declare callback completion
- Logging complete event/request values that may contain credentials or personal data
- Outbound URLs derived directly from event/request input (SSRF review hotspot)
- Calling `process.exit()` from a handler

Infrastructure rules remain relevant where matching AWS CDK constructs are present. Generated clients do not produce quality findings.

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
