import type { Grade } from "../types.js";
import { THRESHOLDS } from "../../../scanner.config.js";
import { scoreCommentRatio } from "./scoreCommentRatio.js";

/**
 * Grading weights for each metric (must sum to 1.0)
 * - Security issues are weighted highest (instant fail if any)
 * - Cognitive complexity is weighted high (readability matters)
 * - Cyclomatic complexity matters for testability
 * - Maintainability issues indicate code smells
 * - Cleanliness is important but less critical
 * - Comment ratio is a minor factor
 */
const WEIGHTS = {
  security: 0.25, // Security is critical
  cognitive: 0.2, // Code readability
  cyclomatic: 0.15, // Testability
  maintainability: 0.2, // Code smells
  cleanliness: 0.1, // Hygiene
  commentRatio: 0.1, // Documentation
};

/**
 * Grade thresholds (score out of 100)
 * A: 90-100 (Excellent)
 * B: 80-89  (Good)
 * C: 70-79  (Acceptable)
 * D: 60-69  (Needs work)
 * F: 0-59   (Poor)
 */
const GRADE_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
};

interface FileMetrics {
  cognitive: number;
  cyclomatic: number;
  security: number;
  maintainability: number;
  cleanliness: number;
  commentRatio: number;
}

/** Scores a metric whose ideal value is zero. */
function scoreZeroTargetMetric(value: number): number {
  if (value === 0) return 100;
  if (value <= 1) return 60;
  if (value <= 3) return 40;
  if (value <= 5) return 20;
  return 0;
}

/** Scores a metric across its low, medium, and high ranges. */
function scoreRangedMetric(
  value: number,
  thresholds: { low: number; medium: number; high: number },
): number {
  if (value <= thresholds.low) {
    const ratio = value / Math.max(thresholds.low, 1);
    return 100 - ratio * 10;
  }
  if (value <= thresholds.medium) {
    const ratio =
      (value - thresholds.low) / (thresholds.medium - thresholds.low);
    return 90 - ratio * 20;
  }
  if (value <= thresholds.high) {
    const ratio =
      (value - thresholds.medium) / (thresholds.high - thresholds.medium);
    return 70 - ratio * 20;
  }
  const beyondHigh = value - thresholds.high;
  return Math.max(0, 50 - beyondHigh * 5);
}

/** Calculates a score from zero to one hundred for a single metric. */
function scoreMetric(
  value: number,
  thresholds: { low: number; medium: number; high: number },
): number {
  return thresholds.low === 0 && thresholds.medium === 0
    ? scoreZeroTargetMetric(value)
    : scoreRangedMetric(value, thresholds);
}

/**
 * Calculate the overall grade for a file based on its metrics
 */
export function calculateGrade(metrics: FileMetrics): Grade {
  const scores = {
    security: scoreMetric(metrics.security, THRESHOLDS.security),
    cognitive: scoreMetric(metrics.cognitive, THRESHOLDS.cognitive),
    cyclomatic: scoreMetric(metrics.cyclomatic, THRESHOLDS.cyclomatic),
    maintainability: scoreMetric(
      metrics.maintainability,
      THRESHOLDS.maintainability,
    ),
    cleanliness: scoreMetric(metrics.cleanliness, THRESHOLDS.cleanliness),
    commentRatio: scoreCommentRatio(metrics.commentRatio),
  };

  // Calculate weighted average
  const weightedScore =
    scores.security * WEIGHTS.security +
    scores.cognitive * WEIGHTS.cognitive +
    scores.cyclomatic * WEIGHTS.cyclomatic +
    scores.maintainability * WEIGHTS.maintainability +
    scores.cleanliness * WEIGHTS.cleanliness +
    scores.commentRatio * WEIGHTS.commentRatio;

  // Security issues cause an automatic grade cap
  // Any security issue caps grade at C
  // 3+ security issues caps grade at D
  let maxGrade: Grade = "A";
  if (metrics.security > 0) {
    maxGrade = "C";
  }
  if (metrics.security >= 3) {
    maxGrade = "D";
  }
  if (metrics.security >= 5) {
    maxGrade = "F";
  }

  // Convert score to grade
  let grade: Grade;
  if (weightedScore >= GRADE_THRESHOLDS.A) {
    grade = "A";
  } else if (weightedScore >= GRADE_THRESHOLDS.B) {
    grade = "B";
  } else if (weightedScore >= GRADE_THRESHOLDS.C) {
    grade = "C";
  } else if (weightedScore >= GRADE_THRESHOLDS.D) {
    grade = "D";
  } else {
    grade = "F";
  }

  // Apply security cap
  const gradeOrder: Grade[] = ["A", "B", "C", "D", "F"];
  const gradeIndex = gradeOrder.indexOf(grade);
  const maxGradeIndex = gradeOrder.indexOf(maxGrade);
  if (gradeIndex < maxGradeIndex) {
    grade = maxGrade;
  }

  return grade;
}

/**
 * Get a display string for a grade with emoji
 */
export function getGradeDisplay(grade: Grade): string {
  const displays: Record<Grade, string> = {
    A: "🟢 A",
    B: "🟡 B",
    C: "🟠 C",
    D: "🔴 D",
    F: "⛔ F",
  };
  return displays[grade];
}

/**
 * Get a description for a grade
 */
export function getGradeDescription(grade: Grade): string {
  const descriptions: Record<Grade, string> = {
    A: "Excellent - Well-maintained, clean code",
    B: "Good - Minor improvements possible",
    C: "Acceptable - Needs attention",
    D: "Poor - Significant issues to address",
    F: "Failing - Critical issues require immediate attention",
  };
  return descriptions[grade];
}
