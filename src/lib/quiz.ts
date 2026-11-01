import type { PlanId, QuizData } from "../types";

export const PLAN_ORDER: PlanId[] = [
  "beginner",
  "intermediate-one",
  "intermediate-two",
  "advanced-one",
  "advanced-two",
];

export interface CategoryScores {
  upper: number;
  core: number;
  mobility: number;
}

/** Weakest-link score inside each category. Fits every placement result row. */
export function categoryScores(answers: number[]): CategoryScores {
  if (answers.length !== 7 || answers.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error("Quiz answers must be 7 non-negative indexes");
  }
  return {
    upper: Math.min(answers[0], answers[1]),
    core: Math.min(answers[2], answers[3], answers[4]),
    mobility: Math.min(answers[5], answers[6]),
  };
}

/**
 * Placement from the result table.
 * raw = min(weakest strength/core category, mobility + 1).
 * Beginner only when that raw score is 0 and mobility is 0 or 1 with no strength/core.
 * Any stronger single category lifts the floor to Intermediate One.
 * Mobility 2+ with no strength still lands on Intermediate One (not in the result rows; see README).
 */
export function scoreQuiz(answers: number[]): PlanId {
  const scores = categoryScores(answers);
  const strength = Math.min(scores.upper, scores.core);
  const raw = Math.min(strength, scores.mobility + 1);
  if (raw > 0) return PLAN_ORDER[Math.min(raw, 4)];
  const any = scores.upper > 0 || scores.core > 0 || scores.mobility > 0;
  if (!any) return "beginner";
  if (scores.upper === 0 && scores.core === 0 && scores.mobility <= 1) return "beginner";
  return "intermediate-one";
}

export function blurbKeys(scores: CategoryScores): {
  strength: string;
  core: string;
  mobility: string;
  headline?: string;
} {
  const allHigh = scores.upper >= 3 && scores.core >= 3 && scores.mobility >= 3;
  return {
    strength: scores.upper >= 3 ? "strengthHigh" : scores.upper === 0 ? "strengthLow" : "strengthMid",
    core: scores.core >= 3 ? "coreHigh" : scores.core === 0 ? "coreLow" : "coreMid",
    mobility: scores.mobility === 0 ? "mobilityLow" : scores.mobility === 1 ? "mobilityMid" : "mobilityHigh",
    headline: allHigh ? "allHigh" : undefined,
  };
}

export function quizCopy(quiz: QuizData, answers: number[]): {
  level: PlanId;
  levelName: string;
  summary: string;
  lines: string[];
} {
  const level = scoreQuiz(answers);
  const scores = categoryScores(answers);
  const keys = blurbKeys(scores);
  const levelInfo = quiz.levels.find((item) => item.id === level);
  const lines = [keys.headline, keys.strength, keys.core, keys.mobility]
    .filter((key): key is string => Boolean(key))
    .map((key) => quiz.blurbs[key])
    .filter((line): line is string => Boolean(line));
  return {
    level,
    levelName: levelInfo?.name ?? level,
    summary: levelInfo?.summary ?? "",
    lines: [...new Set(lines)],
  };
}

export function planName(id: PlanId): string {
  switch (id) {
    case "beginner":
      return "Beginner";
    case "intermediate-one":
      return "Intermediate One";
    case "intermediate-two":
      return "Intermediate Two";
    case "advanced-one":
      return "Advanced One";
    case "advanced-two":
      return "Advanced Two";
  }
}
