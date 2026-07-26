import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { SUPPORTED_EXTENSIONS } from "../constants.js";
import { GitError } from "../errors.js";

interface RepositoryPaths {
  absoluteTarget: string;
  repositoryRoot: string;
  requestedTarget: string;
}

/** Executes a Git command in the requested working tree. */
function runGit(targetPath: string, arguments_: string[]): string {
  return execFileSync("git", arguments_, {
    cwd: targetPath,
    encoding: "utf-8",
  });
}

/** Resolves canonical repository paths while preserving the requested path form. */
function resolveRepositoryPaths(targetPath: string): RepositoryPaths {
  const requestedTarget = path.resolve(targetPath);
  const absoluteTarget = fs.realpathSync(targetPath);
  const repositoryRoot = fs.realpathSync(
    path.normalize(runGit(targetPath, ["rev-parse", "--show-toplevel"]).trim()),
  );
  return {
    absoluteTarget,
    repositoryRoot,
    requestedTarget,
  };
}

/** Parses NUL-delimited porcelain output into current changed paths. */
function parseChangedPaths(output: string): string[] {
  const records = output.split("\0");
  const changedPaths: string[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!record) continue;

    const status = record.slice(0, 2);
    const isRenameOrCopy = status.includes("R") || status.includes("C");
    if (isRenameOrCopy) index++;
    if (status !== "!!" && !status.includes("D")) {
      changedPaths.push(record.slice(3));
    }
  }
  return changedPaths;
}

/** Returns whether a canonical file belongs to the requested target tree. */
function isWithinTarget(absoluteTarget: string, canonical: string): boolean {
  const relative = path.relative(absoluteTarget, canonical);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

/** Returns whether a changed path has a scannable extension. */
function isSupportedFile(filePath: string, includeHtml: boolean): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return (
    (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension) ||
    (includeHtml && extension === ".html")
  );
}

/** Resolves Git paths into existing output paths under the requested target. */
function resolveChangedFiles(
  changedPaths: string[],
  paths: RepositoryPaths,
  includeHtml: boolean,
): string[] {
  return changedPaths
    .map((filePath) => path.normalize(path.resolve(paths.repositoryRoot, filePath)))
    .filter((canonical) => isWithinTarget(paths.absoluteTarget, canonical))
    .map((canonical) =>
      path.normalize(
        path.resolve(paths.requestedTarget, path.relative(paths.absoluteTarget, canonical)),
      ),
    )
    .filter((filePath) => isSupportedFile(filePath, includeHtml))
    .filter((filePath) => fs.existsSync(filePath));
}

/** Converts an unknown caught value into an Error instance. */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Returns changed scannable files reported by Git. */
export function getGitChangedFiles(targetPath: string, includeHtml = false): string[] {
  try {
    const paths = resolveRepositoryPaths(targetPath);
    const output = runGit(targetPath, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    if (!output) return [];
    return resolveChangedFiles(parseChangedPaths(output), paths, includeHtml);
  } catch (error) {
    const resolvedError = toError(error);
    if (resolvedError.message.includes("not a git repository")) {
      throw new GitError(`${targetPath} is not a git repository`);
    }
    throw new GitError(`Failed to run git status: ${resolvedError.message}`);
  }
}
