import { describe, expect, it } from "vitest";
import { scoreQuiz } from "./quiz";

const ROWS: [number[], string][] = [
  [[0, 0, 0, 0, 0, 0, 0], "beginner"],
  [[0, 0, 0, 0, 0, 1, 1], "beginner"],
  [[1, 1, 1, 1, 1, 1, 1], "intermediate-one"],
  [[2, 2, 2, 2, 2, 2, 2], "intermediate-two"],
  [[3, 3, 3, 3, 3, 2, 2], "advanced-one"],
  [[4, 4, 4, 4, 4, 3, 3], "advanced-two"],
  [[3, 3, 3, 3, 3, 1, 1], "intermediate-two"],
  [[4, 4, 4, 4, 4, 0, 0], "intermediate-one"],
  [[3, 3, 3, 3, 3, 0, 0], "intermediate-one"],
  [[2, 2, 2, 2, 2, 0, 0], "intermediate-one"],
  [[0, 0, 0, 0, 0, 3, 3], "intermediate-one"],
  [[4, 4, 0, 0, 0, 0, 0], "intermediate-one"],
  [[0, 0, 4, 4, 4, 0, 0], "intermediate-one"],
];

describe("placement quiz", () => {
  it("matches every placement result", () => {
    for (const [answers, level] of ROWS) {
      expect(scoreQuiz(answers), answers.join(",")).toBe(level);
    }
  });

  it("keeps a mobility-only score of 2 from falling back to beginner", () => {
    expect(scoreQuiz([0, 0, 0, 0, 0, 2, 2])).toBe("intermediate-one");
  });
});
