import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError } from "../errors.js";
import { resolveFilesToScan } from "./resolveFilesToScan.js";

const temporaryDirectories: string[] = [];
function makeDirectory(name = "scanner-files-"): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), name));
  temporaryDirectories.push(root);
  return root;
}
function write(root: string, relative: string): void {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, "export const value = 1;\n");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

describe("resolveFilesToScan", () => {
  it("treats a target containing glob metacharacters as a literal directory", async () => {
    const parent = makeDirectory();
    const target = path.join(parent, "project[1]");
    write(target, "src/index.ts");
    expect(
      await resolveFilesToScan({
        targetPath: target,
        excludes: [],
        scanGitChanges: false,
        quiet: true,
      }),
    ).toEqual([path.join(target, "src/index.ts")]);
  });

  it("resolves exclusion globs relative to the target directory", async () => {
    const target = makeDirectory();
    write(target, "index.ts");
    write(target, "src/keep.ts");
    write(target, "src/skip.test.ts");
    const files = await resolveFilesToScan({
      targetPath: target,
      excludes: ["**/*.test.ts"],
      scanGitChanges: false,
      quiet: true,
    });
    expect(files.sort()).toEqual(
      [path.join(target, "index.ts"), path.join(target, "src/keep.ts")].sort(),
    );
  });

  it("ignores dependencies, VCS data, coverage, and build outputs by default", async () => {
    const target = makeDirectory();
    for (const file of [
      "src/index.ts",
      "node_modules/pkg/index.js",
      ".git/hooks/test.js",
      "coverage/report.js",
      "dist/bundle.js",
      "build/bundle.js",
      "out/bundle.js",
    ])
      write(target, file);
    expect(
      await resolveFilesToScan({
        targetPath: target,
        excludes: [],
        scanGitChanges: false,
        quiet: true,
      }),
    ).toEqual([path.join(target, "src/index.ts")]);
  });

  it("rejects invalid programmatic excludes", async () => {
    const target = makeDirectory();
    await expect(
      resolveFilesToScan({
        targetPath: target,
        excludes: [""],
        scanGitChanges: false,
        quiet: true,
      }),
    ).rejects.toThrow(ConfigError);
  });
});
