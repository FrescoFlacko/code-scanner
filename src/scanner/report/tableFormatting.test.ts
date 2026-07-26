import { describe, expect, it } from "vitest";
import {
  canShowCommentColumn,
  getDisplayWidth,
  getFileColumnWidth,
  padToDisplayWidth,
  truncatePath,
} from "./tableFormatting.js";

describe("tableFormatting", () => {
  it("removes middle directories before shortening the filename", () => {
    const result = truncatePath(
      "src/features/league/components/HistoricalLeagueInfoErrorBoundary.tsx",
      52,
    );

    expect(result).toBe("src/…/HistoricalLeagueInfoErrorBoundary.tsx");
    expect(getDisplayWidth(result)).toBeLessThanOrEqual(52);
  });

  it("preserves the extension when a long basename must be shortened", () => {
    const result = truncatePath("HistoricalLeagueInfoErrorBoundaryWithMoreContext.tsx", 30);

    expect(result).toMatch(/…\.tsx$/);
    expect(getDisplayWidth(result)).toBeLessThanOrEqual(30);
  });

  it("shortens a long extensionless basename without dropping all visible text", () => {
    const result = truncatePath("averylongextensionlessfilename", 12);

    expect(result).toMatch(/^averylongex…$/);
    expect(getDisplayWidth(result)).toBe(12);
  });

  it("does not split a joined emoji while shortening a filename", () => {
    const result = truncatePath("family-👨‍👩‍👧‍👦-longname.tsx", 14);

    expect(result).toBe("family-👨‍👩‍👧‍👦….tsx");
    expect(getDisplayWidth(result)).toBe(14);
  });

  it("uses remaining terminal space within the file-column limits", () => {
    expect(getFileColumnWidth(80, false)).toBe(17);
    expect(getFileColumnWidth(120, false)).toBe(57);
    expect(getFileColumnWidth(200, false)).toBe(60);
  });

  it("only shows the comment column when it fits beside the minimum file column", () => {
    expect(canShowCommentColumn(80)).toBe(false);
    expect(canShowCommentColumn(100)).toBe(true);
  });

  it("measures Unicode, emoji, and ANSI-styled values by terminal width", () => {
    expect(getDisplayWidth("漢字.ts")).toBe(7);
    expect(getDisplayWidth("🟢 A")).toBe(4);
    expect(getDisplayWidth("\u001B[31mred\u001B[39m")).toBe(3);
    expect(getDisplayWidth(padToDisplayWidth("🟢 A", 6))).toBe(6);
  });
});
