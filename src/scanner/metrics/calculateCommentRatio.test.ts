import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { calculateCommentRatio } from "./calculateCommentRatio.js";

const files: string[] = [];
afterEach(() => {
  for (const file of files.splice(0))
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

function ratio(source: string, extension = ".ts"): number {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-comments-"));
  const file = path.join(directory, `source${extension}`);
  files.push(file);
  fs.writeFileSync(file, source);
  return calculateCommentRatio(file);
}

describe("calculateCommentRatio", () => {
  it("ignores comment-like text in strings, templates, and regular expressions", () => {
    expect(
      ratio(
        'const url = "https://example.com";\nconst template = `// text`;\nconst regex = /\\/\\/not-comment/;\n',
      ),
    ).toBe(0);
  });

  it("counts lexical line and block comments using nonblank source lines", () => {
    expect(
      ratio("const one = 1; // trailing\n\n/* block\n * continued\n */\nconst two = 2;\n"),
    ).toBe(80);
  });

  it("does not let extra blank lines change the ratio", () => {
    expect(ratio("// documented\nconst value = 1;\n")).toBe(
      ratio("\n// documented\n\nconst value = 1;\n\n"),
    );
  });

  it("counts Angular HTML comments without treating attribute text as a comment", () => {
    expect(ratio("<!-- component guidance -->\n<button>Save</button>\n", ".html")).toBe(50);
    expect(ratio('<div title="<!-- not markup -->">Content</div>\n', ".html")).toBe(0);
  });

  it("counts each nonblank line in a multiline HTML comment", () => {
    expect(ratio("<!-- first\n second -->\n<section>Content</section>\n", ".html")).toBe(67);
  });
});
