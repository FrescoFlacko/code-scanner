import path from "node:path";
import stringWidth from "string-width";

const MIN_FILE_COLUMN_WIDTH = 16;
const MAX_FILE_COLUMN_WIDTH = 60;
const FALLBACK_TERMINAL_WIDTH = 120;
const COLUMN_SEPARATOR_WIDTH = 3;
const BASE_COLUMN_WIDTHS = [5, 9, 10, 8, 8, 5] as const;
const COMMENT_COLUMN_WIDTH = 9;
const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

/** Determines whether all metric columns fit in a horizontal layout. */
export function canShowHorizontalTable(terminalWidth: number): boolean {
  return terminalWidth >= getFixedColumnsWidth(false) + MIN_FILE_COLUMN_WIDTH;
}

/** Returns the number of terminal cells occupied by a value. */
export function getDisplayWidth(value: string): number {
  return stringWidth(value);
}

/** Pads a value to a requested terminal width without misaligning Unicode. */
export function padToDisplayWidth(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - getDisplayWidth(value)))}`;
}

/** Returns a safe terminal width, including a deterministic non-TTY fallback. */
export function resolveTerminalWidth(columns: number | undefined = process.stdout.columns): number {
  return typeof columns === "number" && Number.isFinite(columns) && columns > 0
    ? Math.floor(columns)
    : FALLBACK_TERMINAL_WIDTH;
}

/** Determines whether the optional comment column fits with a readable file path. */
export function canShowCommentColumn(terminalWidth: number): boolean {
  return terminalWidth >= getFixedColumnsWidth(true) + MIN_FILE_COLUMN_WIDTH;
}

/** Calculates the file-column width from the space left by fixed metric columns. */
export function getFileColumnWidth(terminalWidth: number, includeComment: boolean): number {
  const availableWidth = terminalWidth - getFixedColumnsWidth(includeComment);
  return Math.max(MIN_FILE_COLUMN_WIDTH, Math.min(MAX_FILE_COLUMN_WIDTH, availableWidth));
}

/** Shortens a path by removing middle directories before truncating its basename. */
export function truncatePath(relativePath: string, width: number): string {
  if (width <= 0) return "";

  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (getDisplayWidth(normalizedPath) <= width) return normalizedPath;

  const segments = normalizedPath.split("/").filter(Boolean);
  const basename = segments.at(-1) ?? normalizedPath;
  const firstDirectory = segments.length > 1 ? segments[0] : null;

  if (firstDirectory) {
    const shortenedDirectories = `${firstDirectory}/…/${basename}`;
    if (getDisplayWidth(shortenedDirectories) <= width) return shortenedDirectories;
  }

  const basenameOnly = `…/${basename}`;
  if (getDisplayWidth(basenameOnly) <= width) return basenameOnly;

  const directoryPrefix = firstDirectory ? `${firstDirectory}/…/` : "";
  const prefix = getDisplayWidth(directoryPrefix) < width - 1 ? directoryPrefix : "";
  return `${prefix}${truncateFilename(basename, width - getDisplayWidth(prefix))}`;
}

/** Returns the width occupied by all columns except the file column. */
function getFixedColumnsWidth(includeComment: boolean): number {
  const widths = includeComment
    ? [...BASE_COLUMN_WIDTHS, COMMENT_COLUMN_WIDTH]
    : [...BASE_COLUMN_WIDTHS];
  const separatorsWidth = widths.length * COLUMN_SEPARATOR_WIDTH;
  return widths.reduce((total, width) => total + width, 0) + separatorsWidth;
}

/** Truncates a filename while retaining its final extension when possible. */
function truncateFilename(filename: string, width: number): string {
  if (width <= 0) return "";
  if (getDisplayWidth(filename) <= width) return filename;
  if (width === 1) return "…";

  const extension = path.posix.extname(filename);
  const extensionWidth = getDisplayWidth(extension);
  const suffix = extensionWidth > 0 && extensionWidth < width - 1 ? `…${extension}` : "…";
  return `${takeStart(filename.slice(0, extension ? -extension.length : undefined), width - getDisplayWidth(suffix))}${suffix}`;
}

/** Takes complete grapheme clusters until a terminal-cell limit is reached. */
function takeStart(value: string, width: number): string {
  let result = "";

  for (const { segment } of GRAPHEME_SEGMENTER.segment(value)) {
    if (getDisplayWidth(`${result}${segment}`) > width) break;
    result += segment;
  }

  return result;
}
