# Production Refactor Plan

This document outlines the step-by-step plan to make `code-scanner` production-grade.

**Scope**: CLI-only tool (not intended as a library for import).
**Exclusion behavior**: Glob patterns (not substring matching).

---

## Current State Assessment

### What's Already Good
- TypeScript strict mode enabled, project builds cleanly
- Code split into focused modules (`report/`, `history/`, `files/`, `cli/`)
- CLI surface is small and understandable
- JSON export is structured with meta/options/totals/priorities/trends/report

### Issues to Address
1. `process.exit()` scattered throughout modules (not just CLI layer)
2. Sync I/O and sync child processes in hot paths
3. CLI parsing lacks validation and error reporting
4. Runtime artifacts (`.scanner-history.json`) committed to repo
5. Path handling not portable (assumes `/` separator)
6. Exclude logic uses substring matching instead of glob patterns
7. No tests for critical logic
8. No `--version` flag; version hardcoded

---

## Phase 1: Error Handling Architecture

**Goal**: Centralize error handling so only the CLI entrypoint decides exit behavior.

### Step 1.1: Create Error Types

**File**: `src/scanner/errors.ts`

```typescript
export class ScannerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ScannerError';
  }
}

export class UserError extends ScannerError {
  constructor(message: string, code: string = 'USER_ERROR') {
    super(message, code);
    this.name = 'UserError';
  }
}

export class GitError extends UserError {
  constructor(message: string) {
    super(message, 'GIT_ERROR');
    this.name = 'GitError';
  }
}

export class ConfigError extends UserError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

export class FileSystemError extends ScannerError {
  constructor(message: string) {
    super(message, 'FS_ERROR');
    this.name = 'FileSystemError';
  }
}
```

### Step 1.2: Update `getGitChangedFiles.ts`

**Changes**:
- Remove `process.exit(1)` calls
- Throw `GitError` instead
- Return empty array for "not a git repo" when appropriate

**Before**:
```typescript
} catch (error) {
  const err = error as Error;
  if (err.message.includes("not a git repository")) {
    console.error(`❌ Error: ${targetPath} is not a git repository`);
  } else {
    console.error(`❌ Error running git status: ${err.message}`);
  }
  process.exit(1);
}
```

**After**:
```typescript
} catch (error) {
  const err = error as Error;
  if (err.message.includes("not a git repository")) {
    throw new GitError(`${targetPath} is not a git repository`);
  }
  throw new GitError(`Failed to run git status: ${err.message}`);
}
```

### Step 1.3: Update `validateTargetPath.ts`

**Changes**:
- Remove any `process.exit()` if present
- Throw `UserError` for invalid paths

### Step 1.4: Update `bin/scanner.js` to Handle Errors

**Changes**:
```javascript
import { scan } from "../dist/src/scanner/index.js";
import { UserError } from "../dist/src/scanner/errors.js";

scan({ fromCli: true }).catch((err) => {
  if (err instanceof UserError) {
    console.error(`❌ ${err.message}`);
    process.exit(2);
  }
  console.error(`❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
```

### Step 1.5: Update `index.ts` Main Flow

**Changes**:
- Remove `process.exit(1)` from JSON write error handling
- Throw `FileSystemError` instead
- Let CLI layer handle exit

**Acceptance Criteria**:
- [ ] No `process.exit()` calls outside `bin/scanner.js`
- [ ] All user errors throw `UserError` or subclass
- [ ] CLI exits with code 2 for user errors, code 1 for unexpected errors

---

## Phase 2: CLI Hardening

**Goal**: Robust CLI parsing with proper validation and feedback.

### Step 2.1: Add `--version` Flag Support

**File**: `src/scanner/cli/parseCliArgs.ts`

**Changes**:
- Add `version: boolean` to `CliArgs` interface
- Parse `--version` and `-v` flags

**File**: `src/scanner/types.ts`

**Changes**:
```typescript
export interface CliArgs {
  // ... existing fields
  version: boolean;
}
```

### Step 2.2: Create Version Reader

**File**: `src/scanner/cli/getVersion.ts`

```typescript
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

export function getVersion(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.resolve(__dirname, "../../../../package.json");
  
  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}
```

### Step 2.3: Validate Required Arguments

**File**: `src/scanner/cli/parseCliArgs.ts`

**Changes**:
- After parsing, validate that `--save-as-json` has a path
- Collect unknown flags and report them

```typescript
const unknownFlags: string[] = [];

// In the parsing loop, track unknown flags:
} else if (arg.startsWith("-")) {
  unknownFlags.push(arg);
}

// After parsing:
if (result.saveAsJson === "") {
  throw new UserError("--save-as-json requires a file path");
}

if (unknownFlags.length > 0) {
  throw new UserError(`Unknown option(s): ${unknownFlags.join(", ")}\nRun with --help for usage.`);
}
```

### Step 2.4: Update `index.ts` for Version

**Changes**:
```typescript
if (cliArgs.version) {
  console.log(getVersion());
  return { report: [], totals: null };
}
```

### Step 2.5: Update JSON Output to Use Dynamic Version

**File**: `src/scanner/index.ts`

**Changes**:
```typescript
import { getVersion } from "./cli/getVersion.js";

// In JSON output:
meta: {
  timestamp: new Date().toISOString(),
  tool: "code-scanner",
  version: getVersion(),
  targetPath,
},
```

**Acceptance Criteria**:
- [ ] `code-scanner --version` prints version from package.json
- [ ] `code-scanner -v` also works
- [ ] `code-scanner --save-as-json` (no path) prints error and exits 2
- [ ] `code-scanner --unknown-flag` prints "Unknown option" and exits 2
- [ ] JSON output `meta.version` matches package.json

---

## Phase 3: Glob-Based Exclusions

**Goal**: Replace substring matching with proper glob pattern matching.

### Step 3.1: Install `micromatch` for Glob Matching

```bash
npm install micromatch
npm install -D @types/micromatch
```

### Step 3.2: Create Exclusion Matcher Module

**File**: `src/scanner/files/matchesExcludePattern.ts`

```typescript
import micromatch from "micromatch";

export function matchesExcludePattern(relativePath: string, excludePatterns: string[]): boolean {
  if (excludePatterns.length === 0) return false;
  return micromatch.isMatch(relativePath, excludePatterns, { dot: true });
}
```

### Step 3.3: Update `resolveFilesToScan.ts`

**Changes**:
- Use `matchesExcludePattern()` for git-changed files filtering
- Keep using glob's `ignore` option for directory scanning (it already supports globs)

**Before**:
```typescript
if (excludes.length > 0) {
  const excludeSet = new Set(excludes);
  files = files.filter((filePath) => {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(targetPath, filePath);
    return !excludeSet.has(fileName) && 
           !excludes.some((pattern) => relativePath.includes(pattern));
  });
}
```

**After**:
```typescript
if (excludes.length > 0) {
  files = files.filter((filePath) => {
    const relativePath = path.relative(targetPath, filePath);
    return !matchesExcludePattern(relativePath, excludes);
  });
}
```

### Step 3.4: Update Help Text

**File**: `src/scanner/cli/printHelp.ts`

**Changes**:
Update the `--exclude` description to mention glob patterns:

```
--exclude, -e <pattern> Exclude files matching glob pattern (can be used multiple times)
                        Examples: "*.test.ts", "**/node_modules/**", "src/generated/*"
```

### Step 3.5: Simplify Glob Ignore Patterns

**File**: `src/scanner/files/resolveFilesToScan.ts`

**Before**:
```typescript
const ignorePatterns = excludes.flatMap((pattern) => [
  `**/${pattern}`,
  `**/${pattern}/**`,
]);
```

**After**:
```typescript
// User provides full glob patterns, use directly
const ignorePatterns = excludes;
```

**Acceptance Criteria**:
- [ ] `--exclude "*.test.ts"` excludes all test files
- [ ] `--exclude "**/fixtures/**"` excludes fixtures directory
- [ ] `--exclude "src/generated/*"` excludes generated files
- [ ] Git-changed files are filtered with same glob logic
- [ ] Help text documents glob pattern support

---

## Phase 4: Path Handling & Portability

**Goal**: Ensure cross-platform compatibility.

### Step 4.1: Fix Path Splitting in `buildReport.ts`

**File**: `src/scanner/report/buildReport.ts`

**Before**:
```typescript
file: result.filePath.split("/").pop() || "",
```

**After**:
```typescript
file: path.basename(result.filePath),
```

### Step 4.2: Normalize Paths in Git Operations

**File**: `src/scanner/git/getGitChangedFiles.ts`

**Changes**:
- Use `path.normalize()` on paths from git output
- Ensure consistent path separators

### Step 4.3: Audit All Path Operations

Review and fix any other instances of:
- Manual path splitting with `/`
- String concatenation for paths (use `path.join`)
- Hardcoded path separators

**Files to audit**:
- `src/scanner/files/buildScanPattern.ts`
- `src/scanner/history/loadHistory.ts`
- `src/scanner/history/saveHistory.ts`
- `src/scanner/config/loadConfigFile.ts`

**Acceptance Criteria**:
- [ ] All path operations use `path` module methods
- [ ] No hardcoded `/` or `\\` separators in path logic
- [ ] Works with paths containing spaces

---

## Phase 5: Clean Up Runtime Artifacts

**Goal**: Remove committed artifacts and ensure clean git state.

### Step 5.1: Remove Committed History Files

```bash
rm src/.scanner-history.json
rm src/scanner/.scanner-history.json
rm test/.scanner-history.json
```

### Step 5.2: Update `.gitignore`

**File**: `.gitignore`

**Ensure these patterns exist**:
```
# History files (runtime artifacts)
.scanner-history.json
**/.scanner-history.json
```

### Step 5.3: Verify No Artifacts in `npm pack`

Run `npm pack --dry-run` and verify no `.scanner-history.json` files are included.

**Acceptance Criteria**:
- [ ] No `.scanner-history.json` files in git
- [ ] `.gitignore` catches all history files
- [ ] `npm pack` excludes runtime artifacts

---

## Phase 6: Testing Infrastructure

**Goal**: Add test coverage for critical logic.

### Step 6.1: Install Test Dependencies

```bash
npm install -D vitest @vitest/coverage-v8
```

### Step 6.2: Add Test Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 6.3: Create Vitest Config

**File**: `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
```

### Step 6.4: Unit Tests for CLI Parsing

**File**: `src/scanner/cli/parseCliArgs.test.ts`

Test cases:
- Default values when no args
- `--help` and `-h` set help flag
- `--version` and `-v` set version flag
- `--save-as-json path.json` sets path
- `--save-as-json=path.json` (equals syntax)
- `--save-as-json` without path throws UserError
- `--exclude pattern` adds to excludes array
- Multiple `--exclude` flags accumulate
- Unknown flags throw UserError
- Positional argument sets targetPath
- Absolute vs relative path handling

### Step 6.5: Unit Tests for Priority Calculation

**File**: `src/scanner/report/calculatePriorities.test.ts`

Test cases:
- Empty report returns empty items
- Files sorted by score descending
- Returns max 3 items
- Primary reason selection logic
- Impact percentages calculated correctly
- Handles zero totals (no division by zero)
- Projected grade calculation

### Step 6.6: Unit Tests for Trends Calculation

**File**: `src/scanner/history/calculateTrends.test.ts`

Test cases:
- No previous history returns null
- New files detected
- Removed files detected
- Improved files detected (security/cognitive decrease)
- Regressed files detected
- Totals diff calculated correctly

### Step 6.7: Unit Tests for Exclusion Matching

**File**: `src/scanner/files/matchesExcludePattern.test.ts`

Test cases:
- Empty patterns never match
- `*.test.ts` matches test files
- `**/*.test.ts` matches nested test files
- `**/node_modules/**` matches node_modules
- Negation patterns (if supported)
- Dot files handling

### Step 6.8: Integration Test Setup

**Directory**: `test/fixtures/sample-project/`

Create a minimal test project with:
- A file with security issues
- A file with complexity issues
- A clean file
- A file to be excluded

**File**: `test/integration/scan.test.ts`

Test cases:
- Scan fixture project and verify report structure
- Verify JSON output schema
- Verify exclusions work
- Verify priorities calculated correctly

**Acceptance Criteria**:
- [ ] `npm test` runs all tests
- [ ] CLI parsing has >90% coverage
- [ ] Priority calculation has >90% coverage
- [ ] Trends calculation has >90% coverage
- [ ] Integration test verifies end-to-end flow

---

## Phase 7: Package Metadata & Release Prep

**Goal**: Prepare for npm publishing.

### Step 7.1: Update `package.json`

```json
{
  "name": "code-scanner",
  "version": "1.0.0",
  "description": "A code quality scanning tool built on ESLint",
  "author": "Your Name <email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/username/code-scanner.git"
  },
  "bugs": {
    "url": "https://github.com/username/code-scanner/issues"
  },
  "homepage": "https://github.com/username/code-scanner#readme",
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "eslint",
    "code-quality",
    "static-analysis",
    "linter",
    "cli"
  ],
  "files": [
    "dist",
    "bin",
    "scanner.config.js"
  ]
}
```

### Step 7.2: Add LICENSE File

Create `LICENSE` file with MIT license text.

### Step 7.3: Update README

Ensure README includes:
- Installation instructions
- Usage examples
- All CLI options documented
- Output format explanation
- Configuration options

### Step 7.4: Add `.npmignore` or Verify `files` Field

Ensure these are NOT published:
- `src/` (only `dist/` should be published)
- `test/`
- `*.md` (except README)
- `.scanner-history.json`
- `tsconfig.json`
- `vitest.config.ts`

**Acceptance Criteria**:
- [ ] `npm pack --dry-run` shows only intended files
- [ ] LICENSE file exists
- [ ] README is comprehensive
- [ ] `engines.node` is specified

---

## Implementation Order

| Phase | Priority | Estimated Effort | Dependencies |
|-------|----------|------------------|--------------|
| Phase 1: Error Handling | High | 2-3 hours | None |
| Phase 2: CLI Hardening | High | 2-3 hours | Phase 1 |
| Phase 3: Glob Exclusions | High | 1-2 hours | None |
| Phase 4: Path Portability | High | 1-2 hours | None |
| Phase 5: Clean Artifacts | Medium | 30 min | None |
| Phase 6: Testing | High | 4-6 hours | Phases 1-4 |
| Phase 7: Package Metadata | Medium | 1-2 hours | Phases 1-6 |

**Total estimated effort**: 12-18 hours

---

## Verification Checklist

Before considering the refactor complete:

- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` passes all tests
- [ ] `code-scanner --help` shows all options
- [ ] `code-scanner --version` shows correct version
- [ ] `code-scanner` runs successfully on the project itself
- [ ] `code-scanner --save-as-json out.json` produces valid JSON
- [ ] JSON `meta.version` matches package.json version
- [ ] `code-scanner --save-as-json` (no path) exits with error
- [ ] `code-scanner --unknown` exits with error
- [ ] `code-scanner --exclude "*.test.ts"` excludes test files
- [ ] No `.scanner-history.json` files in git
- [ ] `npm pack --dry-run` shows only intended files
- [ ] Works on macOS, Linux (and Windows if applicable)
