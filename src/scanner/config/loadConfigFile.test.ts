import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError } from "../errors.js";
import { loadConfigFile } from "./loadConfigFile.js";

const temporaryDirectories: string[] = [];

function directoryWithConfig(config: unknown): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-config-"));
  temporaryDirectories.push(directory);
  fs.writeFileSync(path.join(directory, ".scannerrc.json"), JSON.stringify(config));
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("loadConfigFile", () => {
  it("loads valid exclude patterns", () => {
    expect(loadConfigFile(directoryWithConfig({ exclude: ["**/*.test.ts"] }))).toEqual({
      exclude: ["**/*.test.ts"], profiles: [], rules: {},
    });
  });

  it("loads profiles and rule overrides", () => {
    expect(loadConfigFile(directoryWithConfig({ profiles: ["angular", "strict"], rules: { "sonarjs/file-header": "off" } })))
      .toMatchObject({ profiles: ["angular", "strict"], rules: { "sonarjs/file-header": "off" } });
  });

  it("rejects unknown profiles", () => {
    expect(() => loadConfigFile(directoryWithConfig({ profiles: ["reactish"] }))).toThrow(ConfigError);
  });

  it.each([{ exclude: [123] }, { exclude: [""] }, { exclude: "dist/**" }, []])(
    "rejects invalid configuration shape %#",
    (config) => expect(() => loadConfigFile(directoryWithConfig(config))).toThrow(ConfigError),
  );
});
