import { glob } from "glob";
import path from "path";
import { getGitChangedFiles } from "../git/getGitChangedFiles.js";
import { buildScanPattern } from "./buildScanPattern.js";
import { matchesExcludePattern } from "./matchesExcludePattern.js";

export interface ResolveFilesOptions {
  targetPath: string;
  excludes: string[];
  scanGitChanges: boolean;
  quiet?: boolean;
}

export async function resolveFilesToScan({ targetPath, excludes, scanGitChanges, quiet = false }: ResolveFilesOptions): Promise<string[]> {
  if (scanGitChanges) {
    if (!quiet) {
      console.log(`🔍 Scanning git changes in ${targetPath}...\n`);
    }
    let files = getGitChangedFiles(targetPath);

    if (excludes.length > 0) {
      files = files.filter((filePath) => {
        const relativePath = path.relative(targetPath, filePath);
        return !matchesExcludePattern(relativePath, excludes);
      });
    }
    return files;
  }

  const scanPattern = buildScanPattern(targetPath);
  const excludeInfo = excludes.length > 0 ? ` (excluding: ${excludes.join(", ")})` : "";
  if (!quiet) {
    console.log(`🚀 Scanning ${scanPattern}...${excludeInfo}\n`);
  }

  return glob.sync(scanPattern, { ignore: excludes });
}
