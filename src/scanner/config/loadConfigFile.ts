import fs from "fs";
import path from "path";
import { CONFIG_FILENAME } from "../constants.js";
import { ConfigError } from "../errors.js";
import { PROFILE_NAMES, type ProfileName, type ScannerConfig } from "../types.js";

type JsonObject = Record<string, unknown>;

/** Returns whether a value is a non-array object. */
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns whether a value is a non-empty string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Returns whether a value names a supported scanner profile. */
function isProfileName(value: unknown): value is ProfileName {
  return typeof value === "string" && (PROFILE_NAMES as readonly string[]).includes(value);
}

/** Reads and validates optional exclude patterns. */
function readExcludes(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
    throw new ConfigError(`${CONFIG_FILENAME} "exclude" must be an array of non-empty strings`);
  }
  return value;
}

/** Reads and validates optional scanner profiles. */
function readProfiles(value: unknown): ProfileName[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isProfileName)) {
    throw new ConfigError(`${CONFIG_FILENAME} "profiles" contains an unknown profile`);
  }
  return value;
}

/** Reads and validates optional rule overrides. */
function readRules(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isJsonObject(value)) {
    throw new ConfigError(`${CONFIG_FILENAME} "rules" must be an object`);
  }
  return value;
}

/** Parses and validates a scanner configuration document. */
function parseConfig(content: string): ScannerConfig {
  const parsed: unknown = JSON.parse(content);
  if (!isJsonObject(parsed)) {
    throw new ConfigError(`${CONFIG_FILENAME} must contain a JSON object`);
  }
  return {
    exclude: readExcludes(parsed.exclude),
    profiles: readProfiles(parsed.profiles),
    rules: readRules(parsed.rules),
  };
}

/** Loads the target project's optional scanner configuration. */
export function loadConfigFile(targetPath: string): ScannerConfig {
  const configPath = path.join(targetPath, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    return { exclude: [], profiles: [], rules: {} };
  }

  try {
    return parseConfig(fs.readFileSync(configPath, "utf-8"));
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    console.warn(`⚠️  Warning: Could not parse ${CONFIG_FILENAME}, ignoring config file`);
    return { exclude: [], profiles: [], rules: {} };
  }
}
