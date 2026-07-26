import fs from "fs";
import path from "path";
import { HISTORY_FILENAME } from "../constants.js";
import { PROFILE_NAMES, type ProfileName } from "../types.js";

export interface HistoryData {
  version: 3;
  configurationVersion: number;
  configurationFingerprint: string;
  profiles: ProfileName[];
  timestamp: string;
  totals: {
    files: number;
    security: number;
    maintainability: number;
    cleanliness: number;
    scannerErrors: number;
    avgCognitive: number;
    avgCyclomatic: number;
  };
  files: Record<
    string,
    {
      cognitive: number;
      cyclomatic: number;
      security: number;
      maintainability: number;
      cleanliness: number;
      scannerErrors: number;
      commentRatio: number;
    }
  >;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasFiniteNumbers(value: unknown, keys: readonly string[]): value is JsonObject {
  return isObject(value) && keys.every((key) => Number.isFinite(value[key]));
}

/** Returns whether history has the supported document header. */
function hasHistoryHeader(value: JsonObject): boolean {
  return (
    value.version === 3 &&
    typeof value.timestamp === "string" &&
    !Number.isNaN(Date.parse(value.timestamp))
  );
}

/** Returns whether history has valid configuration metadata. */
function hasConfigurationMetadata(value: JsonObject): boolean {
  return (
    typeof value.configurationVersion === "number" &&
    Number.isInteger(value.configurationVersion) &&
    value.configurationVersion >= 1 &&
    typeof value.configurationFingerprint === "string" &&
    /^[a-f\d]{64}$/.test(value.configurationFingerprint)
  );
}

/** Returns whether history profiles are all supported. */
function hasValidProfiles(value: JsonObject): boolean {
  return (
    Array.isArray(value.profiles) &&
    value.profiles.every(
      (profile) =>
        typeof profile === "string" && (PROFILE_NAMES as readonly string[]).includes(profile),
    )
  );
}

/** Returns whether history totals contain the required finite metrics. */
function hasValidTotals(value: JsonObject): boolean {
  const keys = [
    "files",
    "security",
    "maintainability",
    "cleanliness",
    "scannerErrors",
    "avgCognitive",
    "avgCyclomatic",
  ];
  return (
    hasFiniteNumbers(value.totals, keys) &&
    Number.isInteger(value.totals.files) &&
    Number(value.totals.files) >= 0
  );
}

/** Returns whether every persisted file has all finite metrics. */
function hasValidFiles(value: JsonObject): boolean {
  const keys = [
    "cognitive",
    "cyclomatic",
    "security",
    "maintainability",
    "cleanliness",
    "scannerErrors",
    "commentRatio",
  ];
  return (
    isObject(value.files) &&
    Object.values(value.files).every((file) => hasFiniteNumbers(file, keys))
  );
}

/** Validates the persisted history document contract. */
function isHistoryData(value: unknown): value is HistoryData {
  return (
    isObject(value) &&
    hasHistoryHeader(value) &&
    hasConfigurationMetadata(value) &&
    hasValidProfiles(value) &&
    hasValidTotals(value) &&
    hasValidFiles(value)
  );
}

/** Loads compatible scanner history from a target project. */
export function loadHistory(targetPath: string): HistoryData | null {
  const historyPath = path.join(targetPath, HISTORY_FILENAME);

  if (!fs.existsSync(historyPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(historyPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    if (!isHistoryData(parsed)) {
      console.warn(`⚠️  Warning: Ignoring incompatible or invalid ${HISTORY_FILENAME}`);
      return null;
    }
    return parsed;
  } catch {
    console.warn(`⚠️  Warning: Ignoring unreadable ${HISTORY_FILENAME}`);
    return null;
  }
}
