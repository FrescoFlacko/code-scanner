import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { SUPPORTED_EXTENSIONS } from "../constants.js";
import { GitError } from "../errors.js";

export function getGitChangedFiles(targetPath: string): string[] {
  try {
    const repoRoot = path.normalize(execSync("git rev-parse --show-toplevel", {
      cwd: targetPath,
      encoding: "utf-8",
    }).trim());

    const normalizedTargetPath = path.normalize(targetPath);

    const output = execSync("git status --porcelain", {
      cwd: targetPath,
      encoding: "utf-8",
    });

    if (!output.trim()) {
      return [];
    }

    const files = output
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const status = line.substring(0, 2);
        const filePath = line.substring(3).trim();
        return { status, filePath };
      })
      .filter(({ status }) => {
        const indexStatus = status[0];
        const workTreeStatus = status[1];
        return (
          indexStatus === "M" ||
          indexStatus === "A" ||
          indexStatus === "?" ||
          workTreeStatus === "M" ||
          workTreeStatus === "A"
        );
      })
      .map(({ filePath }) => path.normalize(path.join(repoRoot, filePath)))
      .filter((filePath) => filePath.startsWith(normalizedTargetPath))
      .filter((filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
      })
      .filter((filePath) => fs.existsSync(filePath));

    return files;
  } catch (error) {
    const err = error as Error;
    if (err.message.includes("not a git repository")) {
      throw new GitError(`${targetPath} is not a git repository`);
    }
    throw new GitError(`Failed to run git status: ${err.message}`);
  }
}
