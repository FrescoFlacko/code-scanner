import { describe, expect, it } from "vitest";
import { createConfigurationFingerprint } from "./createConfigurationFingerprint.js";

function fingerprint(overrides: Partial<Parameters<typeof createConfigurationFingerprint>[0]> = {}): string {
  return createConfigurationFingerprint({
    schemaVersion: 4,
    profiles: ["generic"],
    rules: { "no-undef": "warn", complexity: ["warn", { max: 0 }] },
    excludes: ["dist/**"],
    pluginVersions: { eslint: "10.7.0", sonarjs: "4.1.0" },
    ...overrides,
  });
}

describe("createConfigurationFingerprint", () => {
  it("is stable across semantically irrelevant ordering", () => {
    expect(fingerprint({
      profiles: ["strict", "generic"],
      excludes: ["vendor/**", "dist/**"],
      rules: { complexity: ["warn", { max: 0 }], "no-undef": "warn" },
      pluginVersions: { sonarjs: "4.1.0", eslint: "10.7.0" },
    })).toBe(fingerprint({
      profiles: ["generic", "strict"],
      excludes: ["dist/**", "vendor/**"],
    }));
  });

  it.each([
    { rules: { "no-undef": "off" } },
    { excludes: ["dist/**", "generated/**"] },
    { pluginVersions: { eslint: "10.8.0", sonarjs: "4.1.0" } },
    { schemaVersion: 5 },
  ])("changes when scan semantics change %#", (change) => {
    expect(fingerprint(change)).not.toBe(fingerprint());
  });
});
