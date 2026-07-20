import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHistory } from "./loadHistory.js";
import { saveHistory } from "./saveHistory.js";
import type { FileReport, Totals } from "../types.js";

const directories: string[] = [];
const fingerprint = "a".repeat(64);
const totals: Totals = { security: 0, maintainability: 0, cleanliness: 0, scannerErrors: 0, avgCognitive: 1, avgCyclomatic: 1 };
const report: FileReport[] = [{
  file: "/tmp/example.ts", relativePath: "example.ts", cognitive: 1, cyclomatic: 1,
  security: 0, maintainability: 0, cleanliness: 0, scannerErrors: 0, commentRatio: 0.2, grade: "A", issues: [],
}];

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "code-scanner-history-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("history persistence", () => {
  it("round-trips versioned finite history", () => {
    const directory = temporaryDirectory();
    saveHistory(directory, report, totals, fingerprint);

    expect(loadHistory(directory)).toMatchObject({
      version: 3, configurationVersion: 1, configurationFingerprint: fingerprint, profiles: ["generic"],
      totals: { files: 1 }, files: { "example.ts": { cognitive: 1 } },
    });
  });

  it.each([
    {},
    { version: 3, timestamp: new Date().toISOString(), totals: {}, files: {} },
    { version: 3, configurationVersion: 1, configurationFingerprint: fingerprint, profiles: ["generic"], timestamp: new Date().toISOString(), totals: { files: 0, security: 0, maintainability: 0, cleanliness: 0, scannerErrors: 0, avgCognitive: Number.NaN, avgCyclomatic: 0 }, files: {} },
  ])("ignores invalid state %#", (history) => {
    const directory = temporaryDirectory();
    fs.writeFileSync(path.join(directory, ".scanner-history.json"), JSON.stringify(history));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(loadHistory(directory)).toBeNull();
  });

  it("refuses to follow a history symlink", () => {
    const directory = temporaryDirectory();
    const victim = path.join(directory, "victim.json");
    fs.writeFileSync(victim, "do not overwrite");
    fs.symlinkSync(victim, path.join(directory, ".scanner-history.json"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    saveHistory(directory, report, totals, fingerprint);

    expect(fs.readFileSync(victim, "utf8")).toBe("do not overwrite");
    expect(warn).toHaveBeenCalled();
  });
});
