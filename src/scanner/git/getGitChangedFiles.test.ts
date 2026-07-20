import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { getGitChangedFiles } from "./getGitChangedFiles.js";

const repositories: string[] = [];
function repository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-git-"));
  repositories.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "scanner@example.test"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Scanner Test"], { cwd: root });
  return root;
}
function write(
  root: string,
  relative: string,
  content = "export const value = 1;\n",
): void {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}
function commit(root: string): void {
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
}
afterEach(() => {
  for (const root of repositories.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("getGitChangedFiles", () => {
  it("returns untracked paths containing spaces, quotes, unicode, and newlines", () => {
    const root = repository();
    const names = [
      "with space.ts",
      'with"quote.ts',
      "unicodé.ts",
      "with\nnewline.ts",
    ];
    for (const name of names) write(root, name);
    expect(getGitChangedFiles(root).sort()).toEqual(
      names.map((name) => path.join(root, name)).sort(),
    );
  });

  it("returns the destination of a staged rename and subsequent edit", () => {
    const root = repository();
    write(root, "old name.ts");
    commit(root);
    execFileSync("git", ["mv", "old name.ts", "new name.ts"], { cwd: root });
    fs.appendFileSync(
      path.join(root, "new name.ts"),
      "export const changed = 2;\n",
    );
    expect(getGitChangedFiles(root)).toEqual([path.join(root, "new name.ts")]);
  });

  it("does not leak changes from a sibling with the same path prefix", () => {
    const root = repository();
    write(root, "src/inside.ts");
    write(root, "src2/outside.ts");
    expect(getGitChangedFiles(path.join(root, "src"))).toEqual([
      path.join(root, "src", "inside.ts"),
    ]);
  });

  it("preserves a requested symlink path targeting a repository subdirectory", () => {
    const root = repository();
    const requestedTarget = `${root}-src`;
    repositories.push(requestedTarget);
    write(root, "src/inside.ts");
    fs.symlinkSync(path.join(root, "src"), requestedTarget, "dir");

    expect(getGitChangedFiles(requestedTarget)).toEqual([
      path.join(requestedTarget, "inside.ts"),
    ]);
  });
});
