import fs from "fs";

export function calculateCommentRatio(filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const totalLines = lines.length;

  if (totalLines === 0) return 0;

  let commentLines = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inBlockComment) {
      commentLines++;
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith("//")) {
      commentLines++;
      continue;
    }

    if (trimmed.startsWith("/*")) {
      commentLines++;
      if (!trimmed.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }

    if (trimmed.includes("//") && !trimmed.startsWith("http")) {
      const beforeComment = trimmed.split("//")[0];
      if (!beforeComment.includes('"') && !beforeComment.includes("'") && !beforeComment.includes("`")) {
        commentLines += 0.5;
      }
    }
  }

  return Math.round((commentLines / totalLines) * 100);
}
