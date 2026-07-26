# Changelog

All notable changes to `code-scanner` are documented in this file.

## Unreleased

## 1.1.0 - 2026-07-26

### Added

- Added explicit `generic`, `typed`, `node`, `browser`, `react`, `lambda`, `angular`, and
  `strict` scan profiles.
- Added Angular security, template, accessibility, and type-aware checks.
- Added AWS Lambda checks for handler safety, client reuse, sensitive logging, and unsafe
  outbound requests.
- Added profile and rule overrides to `.scannerrc.json`.
- Added configuration fingerprints and plugin versions to JSON and history data.
- Added support for `.mjs`, `.cjs`, `.mts`, and `.cts` files.

### Changed

- Expanded the generic profile with current ESLint, TypeScript, SonarJS, security, and React
  Hooks integrations.
- Separated scanner failures and metric probes from code-quality findings.
- Improved grading, comment-ratio scoring, priority calculations, report tables, and trend
  output.
- Improved Git change discovery for renamed, deleted, untracked, and repository-relative files.
- Made history persistence and console output configurable for programmatic scans.
- Added automatic builds during package preparation and raised the minimum Node.js version to
  20.19.

### Fixed

- Prevented generated files and test files from receiving inappropriate type-aware rules.
- Prevented incompatible history records from producing misleading trend comparisons.
- Made CLI failures return a nonzero exit code when scanner errors prevent complete analysis.
