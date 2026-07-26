import { describe, it, expect } from "vitest";
import { matchesExcludePattern } from "./matchesExcludePattern.js";

describe("matchesExcludePattern", () => {
  describe("empty patterns", () => {
    it("returns false when no patterns provided", () => {
      expect(matchesExcludePattern("src/file.ts", [])).toBe(false);
    });
  });

  describe("exact filename matching", () => {
    it("matches exact filename", () => {
      expect(matchesExcludePattern("test.ts", ["test.ts"])).toBe(true);
    });

    it("does not match different filename", () => {
      expect(matchesExcludePattern("other.ts", ["test.ts"])).toBe(false);
    });
  });

  describe("glob star patterns", () => {
    it("matches files with extension pattern", () => {
      expect(matchesExcludePattern("file.test.ts", ["*.test.ts"])).toBe(true);
      expect(matchesExcludePattern("component.test.ts", ["*.test.ts"])).toBe(true);
    });

    it("does not match files in subdirectories with single star", () => {
      expect(matchesExcludePattern("src/file.test.ts", ["*.test.ts"])).toBe(false);
    });
  });

  describe("globstar patterns (**/)", () => {
    it("matches files at any depth", () => {
      expect(matchesExcludePattern("file.test.ts", ["**/*.test.ts"])).toBe(true);
      expect(matchesExcludePattern("src/file.test.ts", ["**/*.test.ts"])).toBe(true);
      expect(matchesExcludePattern("src/components/Button.test.ts", ["**/*.test.ts"])).toBe(true);
    });

    it("matches directories at any depth", () => {
      expect(matchesExcludePattern("node_modules/package/index.js", ["**/node_modules/**"])).toBe(
        true,
      );
      expect(
        matchesExcludePattern("packages/app/node_modules/dep/file.js", ["**/node_modules/**"]),
      ).toBe(true);
    });
  });

  describe("directory patterns", () => {
    it("matches files in specific directory", () => {
      expect(matchesExcludePattern("dist/bundle.js", ["dist/**"])).toBe(true);
      expect(matchesExcludePattern("dist/chunks/vendor.js", ["dist/**"])).toBe(true);
    });

    it("does not match files outside directory", () => {
      expect(matchesExcludePattern("src/index.ts", ["dist/**"])).toBe(false);
    });
  });

  describe("multiple patterns", () => {
    it("matches if any pattern matches", () => {
      const patterns = ["*.test.ts", "*.spec.ts", "**/__tests__/**"];

      expect(matchesExcludePattern("unit.test.ts", patterns)).toBe(true);
      expect(matchesExcludePattern("unit.spec.ts", patterns)).toBe(true);
      expect(matchesExcludePattern("src/__tests__/unit.ts", patterns)).toBe(true);
    });

    it("does not match if no pattern matches", () => {
      const patterns = ["*.test.ts", "*.spec.ts"];

      expect(matchesExcludePattern("src/index.ts", patterns)).toBe(false);
      expect(matchesExcludePattern("lib/utils.ts", patterns)).toBe(false);
    });
  });

  describe("dotfiles", () => {
    it("matches dotfiles when dot option is enabled", () => {
      expect(matchesExcludePattern(".eslintrc.js", [".*"])).toBe(true);
      expect(matchesExcludePattern(".gitignore", [".*"])).toBe(true);
    });

    it("matches dotfiles in directories", () => {
      expect(matchesExcludePattern("config/.eslintrc", ["**/.*"])).toBe(true);
    });

    it("matches dot directories", () => {
      expect(matchesExcludePattern(".git/config", [".git/**"])).toBe(true);
      expect(matchesExcludePattern(".vscode/settings.json", [".vscode/**"])).toBe(true);
    });
  });

  describe("brace expansion", () => {
    it("matches multiple extensions", () => {
      expect(matchesExcludePattern("file.ts", ["*.{ts,tsx}"])).toBe(true);
      expect(matchesExcludePattern("file.tsx", ["*.{ts,tsx}"])).toBe(true);
      expect(matchesExcludePattern("file.js", ["*.{ts,tsx}"])).toBe(false);
    });

    it("matches multiple directories", () => {
      expect(matchesExcludePattern("dist/file.js", ["{dist,build}/**"])).toBe(true);
      expect(matchesExcludePattern("build/file.js", ["{dist,build}/**"])).toBe(true);
      expect(matchesExcludePattern("src/file.js", ["{dist,build}/**"])).toBe(false);
    });
  });

  describe("common exclusion patterns", () => {
    it("excludes node_modules", () => {
      expect(matchesExcludePattern("node_modules/lodash/index.js", ["node_modules/**"])).toBe(true);
    });

    it("excludes test files", () => {
      const patterns = [
        "**/*.test.{ts,tsx,js,jsx}",
        "**/*.spec.{ts,tsx,js,jsx}",
        "**/__tests__/**",
      ];

      expect(matchesExcludePattern("src/utils.test.ts", patterns)).toBe(true);
      expect(matchesExcludePattern("src/utils.spec.tsx", patterns)).toBe(true);
      expect(matchesExcludePattern("src/__tests__/utils.ts", patterns)).toBe(true);
      expect(matchesExcludePattern("src/utils.ts", patterns)).toBe(false);
    });

    it("excludes build artifacts", () => {
      const patterns = ["dist/**", "build/**", "out/**", "*.min.js"];

      expect(matchesExcludePattern("dist/index.js", patterns)).toBe(true);
      expect(matchesExcludePattern("build/bundle.js", patterns)).toBe(true);
      expect(matchesExcludePattern("vendor.min.js", patterns)).toBe(true);
      expect(matchesExcludePattern("src/index.ts", patterns)).toBe(false);
    });
  });

  describe("path separator handling", () => {
    it("handles forward slashes", () => {
      expect(matchesExcludePattern("src/components/Button.tsx", ["src/components/**"])).toBe(true);
    });

    it("handles paths without leading slash", () => {
      expect(matchesExcludePattern("components/Button.tsx", ["components/**"])).toBe(true);
    });
  });
});
