import fs from "fs";
import path from "node:path";
import ts from "typescript";

const COMMENT_KINDS = new Set([
  ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia,
]);

interface SourceLayout {
  lineStarts: number[];
  sourceLines: Set<number>;
}

type AddCommentRange = (start: number, end: number) => void;

interface HtmlScanState {
  inTag: boolean;
  quote: '"' | "'" | null;
}

/** Finds the zero-based line containing a source position. */
function findLineAtPosition(lineStarts: number[], position: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lineStarts[middle] <= position) low = middle + 1;
    else high = middle - 1;
  }
  return Math.max(0, high);
}

/** Returns the width of the line break following a line. */
function getLineBreakWidth(content: string, lineEnd: number): number {
  return content.slice(lineEnd, lineEnd + 2) === "\r\n" ? 2 : 1;
}

/** Maps non-empty source lines to their character offsets. */
function buildSourceLayout(content: string): SourceLayout {
  const lines = content.split(/\r?\n/);
  const sourceLines = new Set<number>();
  const lineStarts: number[] = [];
  let offset = 0;

  for (let line = 0; line < lines.length; line++) {
    lineStarts.push(offset);
    if (lines[line].trim().length > 0) sourceLines.add(line);
    const lineEnd = offset + lines[line].length;
    offset = lineEnd + getLineBreakWidth(content, lineEnd);
  }
  return { lineStarts, sourceLines };
}

/** Creates a collector that records source lines intersecting comments. */
function createCommentRangeCollector(
  layout: SourceLayout,
  commentLines: Set<number>,
): AddCommentRange {
  return (start, end) => {
    const startLine = findLineAtPosition(layout.lineStarts, start);
    const endLine = findLineAtPosition(layout.lineStarts, Math.max(start, end));
    for (let line = startLine; line <= endLine; line++) {
      if (layout.sourceLines.has(line)) commentLines.add(line);
    }
  };
}

/** Collects JavaScript and TypeScript comment ranges using the TS scanner. */
function collectScriptComments(content: string, addCommentRange: AddCommentRange): void {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, content);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (COMMENT_KINDS.has(token)) {
      addCommentRange(scanner.getTokenPos(), scanner.getTextPos() - 1);
    }
  }
}

/** Finds the inclusive end position of an HTML comment. */
function findHtmlCommentEnd(content: string, start: number): number {
  const closingIndex = content.indexOf("-->", start + 4);
  return closingIndex === -1 ? content.length - 1 : closingIndex + 2;
}

/** Applies one character to the HTML tag and quote tracking state. */
function updateHtmlScanState(state: HtmlScanState, character: string): void {
  if (state.inTag && (character === '"' || character === "'")) {
    state.quote = state.quote === character ? null : (state.quote ?? character);
    return;
  }
  if (!state.quote && character === "<") state.inTag = true;
  if (!state.quote && character === ">") state.inTag = false;
}

/** Collects HTML comments without treating comment syntax inside tags as markup. */
function collectHtmlComments(content: string, addCommentRange: AddCommentRange): void {
  let index = 0;
  const state: HtmlScanState = { inTag: false, quote: null };

  while (index < content.length) {
    if (!state.quote && content.startsWith("<!--", index)) {
      const end = findHtmlCommentEnd(content, index);
      addCommentRange(index, end);
      index = end + 1;
      continue;
    }
    updateHtmlScanState(state, content[index]);
    index++;
  }
}

/** Calculates the percentage of non-empty lines intersecting comments. */
export function calculateCommentRatio(filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  const layout = buildSourceLayout(content);
  if (layout.sourceLines.size === 0) return 0;

  const commentLines = new Set<number>();
  const addCommentRange = createCommentRangeCollector(layout, commentLines);
  if (path.extname(filePath).toLowerCase() === ".html") {
    collectHtmlComments(content, addCommentRange);
  } else {
    collectScriptComments(content, addCommentRange);
  }
  return Math.round((commentLines.size / layout.sourceLines.size) * 100);
}
