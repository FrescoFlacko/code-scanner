import fs from "fs";
import path from "path";
import { CONFIG_FILENAME } from "../constants.js";
import type { ScannerConfig } from "../types.js";

export function loadConfigFile(targetPath: string): ScannerConfig {
  const configPath = path.join(targetPath, CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    return { exclude: [] };
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(content) as { exclude?: unknown };
    return {
      exclude: Array.isArray(config.exclude) ? config.exclude : [],
    };
  } catch {
    console.warn(`⚠️  Warning: Could not parse ${CONFIG_FILENAME}, ignoring config file`);
    return { exclude: [] };
  }
}
