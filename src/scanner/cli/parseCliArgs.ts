import path from "path";
import { DEFAULT_PATH } from "../constants.js";
import { UserError } from "../errors.js";
import { PROFILE_NAMES, type CliArgs, type ProfileName } from "../types.js";

type BooleanCliProperty =
  "showLegend" | "scanGitChanges" | "listIssues" | "help" | "version";
type ValueFlag = "saveAsJson" | "exclude" | "profile";

interface ParsedOption {
  name: string;
  inlineValue?: string;
}

interface RequiredValue {
  value: string;
  consumedArguments: number;
}

const BOOLEAN_FLAGS: Record<string, BooleanCliProperty> = {
  "--legend": "showLegend",
  "--list-issues": "listIssues",
  "--scan-git-changes": "scanGitChanges",
  "--help": "help",
  "-h": "help",
  "--version": "version",
  "-v": "version",
};

const VALUE_FLAGS: Record<string, ValueFlag> = {
  "--save-as-json": "saveAsJson",
  "--exclude": "exclude",
  "-e": "exclude",
  "--profile": "profile",
  "-p": "profile",
};

/** Creates the default state used before command-line arguments are applied. */
function createDefaultArguments(): CliArgs {
  return {
    targetPath: DEFAULT_PATH,
    showLegend: false,
    excludes: [],
    scanGitChanges: false,
    listIssues: false,
    saveAsJson: null,
    help: false,
    version: false,
    profiles: [],
  };
}

/** Splits a long option from an optional inline `=value`. */
function parseOption(argument: string): ParsedOption {
  const equalsIndex = argument.indexOf("=");
  return equalsIndex < 0
    ? { name: argument }
    : {
        name: argument.slice(0, equalsIndex),
        inlineValue: argument.slice(equalsIndex + 1),
      };
}

/** Resolves a required inline or following option value. */
function readRequiredValue(
  option: ParsedOption,
  nextArgument: string | undefined,
  errorMessage: string,
): RequiredValue {
  if (option.inlineValue !== undefined) {
    if (option.inlineValue.length === 0) throw new UserError(errorMessage);
    return { value: option.inlineValue, consumedArguments: 0 };
  }
  if (nextArgument?.startsWith("-") === false) {
    return { value: nextArgument, consumedArguments: 1 };
  }
  throw new UserError(errorMessage);
}

/** Validates and returns a configured scanner profile name. */
function parseProfile(value: string): ProfileName {
  if (!(PROFILE_NAMES as readonly string[]).includes(value)) {
    throw new UserError(`Unknown profile: ${value || "<empty>"}`);
  }
  return value as ProfileName;
}

/** Applies an option that requires a value and returns consumed arguments. */
function applyValueOption(
  result: CliArgs,
  flag: ValueFlag,
  option: ParsedOption,
  nextArgument: string | undefined,
): number {
  const errorMessages: Record<ValueFlag, string> = {
    saveAsJson: "--save-as-json requires a file path",
    exclude: `${option.name} requires a non-empty glob pattern`,
    profile: `${option.name} requires a profile name`,
  };
  const required = readRequiredValue(option, nextArgument, errorMessages[flag]);

  if (flag === "saveAsJson") result.saveAsJson = required.value;
  if (flag === "exclude") result.excludes.push(required.value);
  if (flag === "profile") result.profiles.push(parseProfile(required.value));
  return required.consumedArguments;
}

/** Applies a positional target path while enforcing the single-path contract. */
function applyTargetPath(
  result: CliArgs,
  argument: string,
  positionalPath: string | undefined,
): string {
  if (positionalPath !== undefined) {
    throw new UserError(
      `Only one target path may be provided: ${positionalPath}, ${argument}`,
    );
  }
  result.targetPath = path.isAbsolute(argument)
    ? argument
    : path.resolve(process.cwd(), argument);
  return argument;
}

/** Parses command-line arguments into scanner options. */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const result = createDefaultArguments();
  const unknownFlags: string[] = [];
  let positionalPath: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith("-")) {
      positionalPath = applyTargetPath(result, argument, positionalPath);
      continue;
    }

    const option = parseOption(argument);
    const booleanProperty = BOOLEAN_FLAGS[option.name];
    if (booleanProperty !== undefined && option.inlineValue === undefined) {
      result[booleanProperty] = true;
      continue;
    }

    const valueFlag = VALUE_FLAGS[option.name];
    if (valueFlag !== undefined) {
      index += applyValueOption(result, valueFlag, option, argv[index + 1]);
      continue;
    }
    unknownFlags.push(argument);
  }

  if (unknownFlags.length > 0) {
    throw new UserError(
      `Unknown option(s): ${unknownFlags.join(", ")}\nRun with --help for usage.`,
    );
  }
  return result;
}
