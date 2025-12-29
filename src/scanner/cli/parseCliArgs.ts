import path from "path";
import { DEFAULT_PATH } from "../constants.js";
import { UserError } from "../errors.js";
import type { CliArgs } from "../types.js";

const KNOWN_FLAGS = new Set([
  "--legend",
  "--list-issues",
  "--scan-git-changes",
  "--help", "-h",
  "--version", "-v",
  "--save-as-json",
  "--exclude", "-e",
]);

function isKnownFlag(arg: string): boolean {
  if (KNOWN_FLAGS.has(arg)) return true;
  if (arg.startsWith("--save-as-json=")) return true;
  if (arg.startsWith("--exclude=")) return true;
  return false;
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const result: CliArgs = {
    targetPath: DEFAULT_PATH,
    showLegend: false,
    excludes: [],
    scanGitChanges: false,
    listIssues: false,
    saveAsJson: null,
    help: false,
    version: false,
  };

  const unknownFlags: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--legend") {
      result.showLegend = true;
    } else if (arg === "--list-issues") {
      result.listIssues = true;
    } else if (arg === "--scan-git-changes") {
      result.scanGitChanges = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--save-as-json") {
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result.saveAsJson = argv[i + 1];
        i++;
      } else {
        throw new UserError("--save-as-json requires a file path");
      }
    } else if (arg.startsWith("--save-as-json=")) {
      const value = arg.slice("--save-as-json=".length);
      if (!value) {
        throw new UserError("--save-as-json requires a file path");
      }
      result.saveAsJson = value;
    } else if (arg === "--exclude" || arg === "-e") {
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result.excludes.push(argv[i + 1]);
        i++;
      }
    } else if (arg.startsWith("--exclude=")) {
      result.excludes.push(arg.slice("--exclude=".length));
    } else if (arg.startsWith("-")) {
      if (!isKnownFlag(arg)) {
        unknownFlags.push(arg);
      }
    } else {
      const resolvedPath = path.isAbsolute(arg)
        ? arg
        : path.resolve(process.cwd(), arg);
      result.targetPath = resolvedPath;
    }
  }

  if (unknownFlags.length > 0) {
    throw new UserError(`Unknown option(s): ${unknownFlags.join(", ")}\nRun with --help for usage.`);
  }

  return result;
}
