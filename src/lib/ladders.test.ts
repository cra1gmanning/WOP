import { describe, expect, it } from "vitest";
import { ladderFromMastery, mobilityForStep, parseWork, setChoices } from "./ladders";

describe("step ladders", () => {
  it("builds the Core A1 hold ladder from 5x60s", () => {
    const labels = ladderFromMastery("5x60s").map((step) => step.label);
    expect(labels).toEqual(["3x12s", "5x12s", "3x24s", "4x24s", "4x36s", "5x36s", "4x48s", "4x60s", "5x60s"]);
  });

  it("puts push-ups on the x3 rep ladder, step 6 = 5x9r", () => {
    const steps = ladderFromMastery("5x15r");
    expect(steps[5].label).toBe("5x9r");
    expect(steps[8].label).toBe("5x15r");
  });

  it("matches seated russian twist step 5 and deck squat step 9", () => {
    expect(ladderFromMastery("5x30r")[4].label).toBe("4x18r");
    expect(ladderFromMastery("5x10r")[8].label).toBe("5x10r");
  });

  it("keeps the low-rep and tempo ladders", () => {
    expect(ladderFromMastery("5x5r").map((step) => step.label)).toEqual([
      "3x1r", "5x1r", "3x2r", "4x2r", "4x3r", "5x3r", "4x4r", "4x5r", "5x5r",
    ]);
    expect(ladderFromMastery("5x5rx10s")[0].label).toBe("3x1rx10s");
    expect(ladderFromMastery("5x5rx10s")[8].label).toBe("5x5rx10s");
  });

  it("keeps per-side and suffix text on every step", () => {
    expect(ladderFromMastery("5x10r@")[0].label).toBe("3x2r@");
    expect(parseWork("5x15s@")?.label).toBe("5x15s@");
    expect(ladderFromMastery("5x5r + 10s")[2].label).toBe("3x2r + 10s");
    expect(parseWork("5x5r (over & back)")?.label).toBe("5x5r (over & back)");
  });

  it("repeats a mastery that is not a 5×5N ladder", () => {
    const steps = ladderFromMastery("5x5/4 RC");
    expect(steps).toHaveLength(9);
    expect(steps.every((step) => step.label === "5x5/4 RC")).toBe(true);
  });

  it("borrows the strength set count for the paired mobility drill", () => {
    const strength = ladderFromMastery("5x60s")[4];
    expect(mobilityForStep("5x5r", strength).label).toBe("4x5r");
    const row = ladderFromMastery("5x15r")[0];
    expect(mobilityForStep("5x15s@", row).label).toBe("3x15s@");
  });

  it("offers a reps dropdown that includes the target", () => {
    expect(setChoices(9, "r")).toContain(9);
    expect(setChoices(60, "s")).toEqual(expect.arrayContaining([0, 60]));
    expect(setChoices(1, "custom")).toEqual([0, 1]);
  });
});
