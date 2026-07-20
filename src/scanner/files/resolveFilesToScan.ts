import { glob } from "glob";
import path from "path";
import { getGitChangedFiles } from "../git/getGitChangedFiles.js";
import { buildScanPattern } from "./buildScanPattern.js";
import { matchesExcludePattern } from "./matchesExcludePattern.js";
import { ConfigError } from "../errors.js";

export const DEFAULT_EXCLUDES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/coverage/**",
  "**/{dist,build,out}/**",
] as const;

export interface ResolveFilesOptions {
  targetPath: string;
  excludes: string[];
  scanGitChanges: boolean;
  quiet?: boolean;
  includeHtml?: boolean;
}

export async function resolveFilesToScan({ targetPath, excludes, scanGitChanges, quiet = false, includeHtml = false }: ResolveFilesOptions): Promise<string[]> {
  if (!Array.isArray(excludes) || excludes.some((pattern) => typeof pattern !== "string" || pattern.trim() === "")) {
    throw new ConfigError("Exclude patterns must be non-empty strings");
  }
  const effectiveExcludes = [...DEFAULT_EXCLUDES, ...excludes];

  if (scanGitChanges) {
    if (!quiet) {
      console.log(`🔍 Scanning git changes in ${targetPath}...\n`);
    }
    let files = getGitChangedFiles(targetPath, includeHtml);

    if (effectiveExcludes.length > 0) {
      files = files.filter((filePath) => {
        const relativePath = path.relative(targetPath, filePath).split(path.sep).join("/");
        return !matchesExcludePattern(relativePath, effectiveExcludes);
      });
    }
    return files;
  }

  const scanPattern = buildScanPattern(includeHtml);
  const excludeInfo = excludes.length > 0 ? ` (excluding: ${excludes.join(", ")})` : "";
  if (!quiet) {
    console.log(`🚀 Scanning ${scanPattern}...${excludeInfo}\n`);
  }

  return glob(scanPattern, {
    cwd: targetPath,
    absolute: true,
    nodir: true,
    ignore: effectiveExcludes,
  });
}
