import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { HISTORY_FILENAME } from "../constants.js";
import type { FileReport, ProfileName, Totals } from "../types.js";

export function saveHistory(
  targetPath: string,
  report: FileReport[],
  totals: Totals,
  configurationFingerprint: string,
  profiles: ProfileName[] = ["generic"],
  configurationVersion = 1,
): void {
  const historyPath = path.join(targetPath, HISTORY_FILENAME);
  const temporaryPath = path.join(targetPath, `.${HISTORY_FILENAME}.${process.pid}.${randomUUID()}.tmp`);

  const fileResults: Record<string, {
    cognitive: number;
    cyclomatic: number;
    security: number;
    maintainability: number;
    cleanliness: number;
    scannerErrors: number;
    commentRatio: number;
  }> = {};

  report.forEach((r) => {
    fileResults[r.relativePath] = {
      cognitive: r.cognitive,
      cyclomatic: r.cyclomatic,
      security: r.security,
      maintainability: r.maintainability,
      cleanliness: r.cleanliness,
      scannerErrors: r.scannerErrors,
      commentRatio: r.commentRatio,
    };
  });

  const history = {
    version: 3 as const,
    configurationVersion,
    configurationFingerprint,
    profiles,
    timestamp: new Date().toISOString(),
    totals: {
      files: report.length,
      security: totals.security,
      maintainability: totals.maintainability,
      cleanliness: totals.cleanliness,
      scannerErrors: totals.scannerErrors,
      avgCognitive: totals.avgCognitive,
      avgCyclomatic: totals.avgCyclomatic,
    },
    files: fileResults,
  };

  try {
    if (fs.existsSync(historyPath)) {
      const destination = fs.lstatSync(historyPath);
      if (!destination.isFile() || destination.isSymbolicLink()) {
        throw new Error("history destination is not a regular file");
      }
    }
    fs.writeFileSync(temporaryPath, JSON.stringify(history, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.renameSync(temporaryPath, historyPath);
  } catch {
    try { fs.unlinkSync(temporaryPath); } catch { /* temporary file was never created or already moved */ }
    console.warn(`⚠️  Warning: Could not save history to ${HISTORY_FILENAME}`);
  }
}
