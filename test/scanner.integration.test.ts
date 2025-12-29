import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { scan } from "../src/scanner/index.js";
import fs from "fs";
import path from "path";

const FIXTURES_PATH = path.join(process.cwd(), "test/fixtures");
const HISTORY_FILE = path.join(FIXTURES_PATH, ".scanner-history.json");

describe("scanner integration", () => {
  afterAll(() => {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
  });

  describe("scan()", () => {
    it("scans directory and returns report with totals", async () => {
      const result = await scan({
        targetPath: FIXTURES_PATH,
        excludes: [],
        scanGitChanges: false,
      });

      expect(result.report).toBeInstanceOf(Array);
      expect(result.report.length).toBeGreaterThan(0);
      expect(result.totals).not.toBeNull();
      expect(result.totals).toHaveProperty("security");
      expect(result.totals).toHaveProperty("maintainability");
      expect(result.totals).toHaveProperty("cleanliness");
      expect(result.totals).toHaveProperty("avgCognitive");
      expect(result.totals).toHaveProperty("avgCyclomatic");
    });

    it("includes file path and metrics in each report entry", async () => {
      const result = await scan({
        targetPath: FIXTURES_PATH,
        excludes: [],
      });

      const fileReport = result.report[0];
      expect(fileReport).toHaveProperty("file");
      expect(fileReport).toHaveProperty("relativePath");
      expect(fileReport).toHaveProperty("cognitive");
      expect(fileReport).toHaveProperty("cyclomatic");
      expect(fileReport).toHaveProperty("security");
      expect(fileReport).toHaveProperty("maintainability");
      expect(fileReport).toHaveProperty("cleanliness");
      expect(fileReport).toHaveProperty("grade");
      expect(fileReport).toHaveProperty("issues");
    });

    it("assigns grade based on metrics", async () => {
      const result = await scan({
        targetPath: FIXTURES_PATH,
        excludes: [],
      });

      const validGrades = ["A", "B", "C", "D", "F"];
      result.report.forEach((file) => {
        expect(validGrades).toContain(file.grade);
      });
    });

    it("respects exclude patterns", async () => {
      const result = await scan({
        targetPath: FIXTURES_PATH,
        excludes: ["**/*.ts"],
      });

      expect(result.report).toHaveLength(0);
    });

    it("returns empty report for help option", async () => {
      const originalLog = console.log;
      console.log = () => {};

      try {
        const result = await scan({ help: true });
        expect(result.report).toHaveLength(0);
        expect(result.totals).toBeNull();
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe("history tracking", () => {
    beforeAll(async () => {
      if (fs.existsSync(HISTORY_FILE)) {
        fs.unlinkSync(HISTORY_FILE);
      }
    });

    it("creates history file on first scan and returns trends on subsequent scans", async () => {
      const firstResult = await scan({
        targetPath: FIXTURES_PATH,
        excludes: [],
      });

      expect(fs.existsSync(HISTORY_FILE)).toBe(true);
      expect(firstResult.trends).toBeUndefined();

      const secondResult = await scan({
        targetPath: FIXTURES_PATH,
        excludes: [],
      });

      expect(secondResult.trends).toBeDefined();
      expect(secondResult.trends).toHaveProperty("totals");
      expect(secondResult.trends).toHaveProperty("improved");
      expect(secondResult.trends).toHaveProperty("regressed");
      expect(secondResult.trends).toHaveProperty("new");
      expect(secondResult.trends).toHaveProperty("removed");
    });
  });
});
