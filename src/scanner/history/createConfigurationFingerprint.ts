import { createHash } from "node:crypto";
import type { ProfileName } from "../types.js";

export interface ConfigurationFingerprintInput {
  schemaVersion: number;
  profiles: ProfileName[];
  rules: Record<string, unknown>;
  excludes: string[];
  pluginVersions: Record<string, string>;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]),
    );
  }
  if (value === undefined) return "__undefined__";
  if (typeof value === "bigint") return value.toString();
  return value;
}

/**
 * Identifies the complete scan contract used by trend comparison. Arrays whose
 * order has no semantic meaning are canonicalized before hashing.
 */
export function createConfigurationFingerprint(input: ConfigurationFingerprintInput): string {
  const normalized = normalize({
    schemaVersion: input.schemaVersion,
    profiles: [...new Set(input.profiles)].sort(),
    rules: input.rules,
    excludes: [...new Set(input.excludes)].sort(),
    pluginVersions: input.pluginVersions,
  });

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
