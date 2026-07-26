/** Calculates comment-ratio quality using the project's ideal 5-30% range. */
export function scoreCommentRatio(ratio: number): number {
  if (ratio >= 5 && ratio <= 30) return 100;
  if (ratio < 5) return 60 + (ratio / 5) * 40;
  if (ratio <= 50) return 100 - (ratio - 30) * 2;
  return 50;
}
