import fs from "fs";
import path from "path";
import { HISTORY_FILENAME } from "../constants.js";

export interface HistoryData {
  timestamp: string;
  totals: {
    files: number;
    security: number;
    maintainability: number;
    cleanliness: number;
    avgCognitive: number;
    avgCyclomatic: number;
  };
  files: Record<string, {
    cognitive: number;
    cyclomatic: number;
    security: number;
    maintainability: number;
    cleanliness: number;
    commentRatio: number;
  }>;
}

export function loadHistory(targetPath: string): HistoryData | null {
  const historyPath = path.join(targetPath, HISTORY_FILENAME);

  if (!fs.existsSync(historyPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(historyPath, "utf-8");
    return JSON.parse(content) as HistoryData;
  } catch {
    return null;
  }
}
