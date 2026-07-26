import { describe, it, expect } from "vitest";
import { parseCliArgs } from "./parseCliArgs.js";
import { UserError } from "../errors.js";

describe("parseCliArgs", () => {
  describe("default values", () => {
    it("returns default values when no args", () => {
      const result = parseCliArgs([]);
      expect(result.targetPath).toBe("./src");
      expect(result.showLegend).toBe(false);
      expect(result.excludes).toEqual([]);
      expect(result.scanGitChanges).toBe(false);
      expect(result.listIssues).toBe(false);
      expect(result.saveAsJson).toBe(null);
      expect(result.help).toBe(false);
      expect(result.version).toBe(false);
      expect(result.profiles).toEqual([]);
    });
  });

  describe("--profile flag", () => {
    it("collects explicit profiles", () => {
      expect(parseCliArgs(["--profile", "angular", "--profile=lambda"]).profiles).toEqual([
        "angular",
        "lambda",
      ]);
    });

    it("rejects unknown and missing profiles", () => {
      expect(() => parseCliArgs(["--profile", "reactish"])).toThrow(UserError);
      expect(() => parseCliArgs(["--profile"])).toThrow(UserError);
    });
  });

  describe("--help flag", () => {
    it("sets help to true with --help", () => {
      const result = parseCliArgs(["--help"]);
      expect(result.help).toBe(true);
    });

    it("sets help to true with -h", () => {
      const result = parseCliArgs(["-h"]);
      expect(result.help).toBe(true);
    });
  });

  describe("--version flag", () => {
    it("sets version to true with --version", () => {
      const result = parseCliArgs(["--version"]);
      expect(result.version).toBe(true);
    });

    it("sets version to true with -v", () => {
      const result = parseCliArgs(["-v"]);
      expect(result.version).toBe(true);
    });
  });

  describe("--save-as-json flag", () => {
    it("sets saveAsJson with space-separated path", () => {
      const result = parseCliArgs(["--save-as-json", "output.json"]);
      expect(result.saveAsJson).toBe("output.json");
    });

    it("sets saveAsJson with equals syntax", () => {
      const result = parseCliArgs(["--save-as-json=output.json"]);
      expect(result.saveAsJson).toBe("output.json");
    });

    it("throws UserError when --save-as-json has no path", () => {
      expect(() => parseCliArgs(["--save-as-json"])).toThrow(UserError);
      expect(() => parseCliArgs(["--save-as-json"])).toThrow("--save-as-json requires a file path");
    });

    it("throws UserError when --save-as-json= has empty value", () => {
      expect(() => parseCliArgs(["--save-as-json="])).toThrow(UserError);
    });
  });

  describe("--exclude flag", () => {
    it("adds single exclude pattern", () => {
      const result = parseCliArgs(["--exclude", "*.test.ts"]);
      expect(result.excludes).toEqual(["*.test.ts"]);
    });

    it("adds multiple exclude patterns", () => {
      const result = parseCliArgs(["--exclude", "*.test.ts", "--exclude", "*.spec.ts"]);
      expect(result.excludes).toEqual(["*.test.ts", "*.spec.ts"]);
    });

    it("supports -e shorthand", () => {
      const result = parseCliArgs(["-e", "*.test.ts"]);
      expect(result.excludes).toEqual(["*.test.ts"]);
    });

    it("supports equals syntax", () => {
      const result = parseCliArgs(["--exclude=*.test.ts"]);
      expect(result.excludes).toEqual(["*.test.ts"]);
    });

    it.each([["--exclude"], ["-e"], ["--exclude="]])(
      "rejects a missing pattern for %s",
      (...args) => {
        expect(() => parseCliArgs(args)).toThrow(UserError);
        expect(() => parseCliArgs(args)).toThrow(/requires a non-empty glob pattern/);
      },
    );
  });

  describe("boolean flags", () => {
    it("sets showLegend with --legend", () => {
      const result = parseCliArgs(["--legend"]);
      expect(result.showLegend).toBe(true);
    });

    it("sets listIssues with --list-issues", () => {
      const result = parseCliArgs(["--list-issues"]);
      expect(result.listIssues).toBe(true);
    });

    it("sets scanGitChanges with --scan-git-changes", () => {
      const result = parseCliArgs(["--scan-git-changes"]);
      expect(result.scanGitChanges).toBe(true);
    });
  });

  describe("positional argument (target path)", () => {
    it("sets targetPath from positional argument", () => {
      const result = parseCliArgs(["./lib"]);
      expect(result.targetPath).toMatch(/lib$/);
    });

    it("resolves relative paths", () => {
      const result = parseCliArgs(["./src/scanner"]);
      expect(result.targetPath).toContain("src/scanner");
    });

    it("preserves absolute paths", () => {
      const result = parseCliArgs(["/absolute/path"]);
      expect(result.targetPath).toBe("/absolute/path");
    });

    it("rejects multiple positional paths", () => {
      expect(() => parseCliArgs(["./src", "./lib"])).toThrow(
        "Only one target path may be provided",
      );
    });
  });

  describe("unknown flags", () => {
    it("throws UserError for unknown flags", () => {
      expect(() => parseCliArgs(["--unknown-flag"])).toThrow(UserError);
      expect(() => parseCliArgs(["--unknown-flag"])).toThrow("Unknown option(s): --unknown-flag");
    });

    it("throws UserError listing multiple unknown flags", () => {
      expect(() => parseCliArgs(["--foo", "--bar"])).toThrow("Unknown option(s): --foo, --bar");
    });

    it("includes help hint in error message", () => {
      expect(() => parseCliArgs(["--unknown"])).toThrow("Run with --help for usage.");
    });
  });

  describe("combined flags", () => {
    it("handles multiple flags together", () => {
      const result = parseCliArgs(["./lib", "--list-issues", "--exclude", "*.test.ts", "--legend"]);
      expect(result.targetPath).toMatch(/lib$/);
      expect(result.listIssues).toBe(true);
      expect(result.excludes).toEqual(["*.test.ts"]);
      expect(result.showLegend).toBe(true);
    });
  });
});
