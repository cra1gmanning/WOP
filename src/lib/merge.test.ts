import { describe, expect, it } from "vitest";
import { mergeState } from "./merge";
import { createState } from "../state/default";
import type { AppState, LogEntry } from "../types";

function log(id: string, updatedAt: string, title: string): LogEntry {
  return { id, date: "2026-11-02", title, kind: "log", updatedAt };
}

describe("state merge", () => {
  it("keeps both devices' logs and the newer slot", () => {
    const phone = createState("2026-11-02T10:00:00.000Z");
    const pc = createState("2026-11-02T09:00:00.000Z");
    phone.slots["upper.A"] = { exerciseId: "HBP/PE2", step: 6, updatedAt: "2026-11-02T10:00:00.000Z" };
    pc.slots["upper.A"] = { exerciseId: "HBP/PE2", step: 5, updatedAt: "2026-11-02T09:00:00.000Z" };
    pc.slots["core.A"] = { exerciseId: "FL/PE1", step: 2, updatedAt: "2026-11-02T09:30:00.000Z" };
    phone.logs = [log("a", "2026-11-02T10:00:00.000Z", "Pushup")];
    pc.logs = [log("b", "2026-11-02T09:40:00.000Z", "Squat")];
    phone.meta = { ...phone.meta, planId: "intermediate-one", updatedAt: "2026-11-02T08:00:00.000Z" };
    pc.meta = { ...pc.meta, planId: "advanced-one", updatedAt: "2026-11-02T11:00:00.000Z" };
    const merged = mergeState(phone, pc);
    expect(merged.logs.map((entry) => entry.id).sort()).toEqual(["a", "b"]);
    expect(merged.slots["upper.A"].step).toBe(6);
    expect(merged.slots["core.A"].step).toBe(2);
    expect(merged.meta.planId).toBe("advanced-one");
  });

  it("unions habits checks and never lowers the unlocked task", () => {
    const phone = createState("2026-11-02T10:00:00.000Z");
    const pc = createState("2026-11-02T12:00:00.000Z");
    phone.habits = {
      ...phone.habits,
      unlockedThrough: 4,
      updatedAt: "2026-11-02T10:00:00.000Z",
      checks: { "2026-11-02|t01": { done: true, updatedAt: "2026-11-02T10:00:00.000Z" } },
    };
    pc.habits = {
      ...pc.habits,
      height: "5 ft 10 in",
      unlockedThrough: 3,
      updatedAt: "2026-11-02T12:00:00.000Z",
      checks: { "2026-11-02|t02": { done: true, updatedAt: "2026-11-02T12:00:00.000Z" } },
    };
    const merged = mergeState(phone, pc);
    expect(merged.habits.height).toBe("5 ft 10 in");
    expect(merged.habits.unlockedThrough).toBe(4);
    expect(merged.habits.checks["2026-11-02|t01"].done).toBe(true);
    expect(merged.habits.checks["2026-11-02|t02"].done).toBe(true);
  });

  it("last write wins a whole day", () => {
    const left = createState("2026-11-01T00:00:00.000Z");
    const right: AppState = {
      ...createState("2026-11-03T00:00:00.000Z"),
      days: {
        "2026-11-02": {
          date: "2026-11-02",
          source: "rest",
          items: [],
          cleared: true,
          updatedAt: "2026-11-03T00:00:00.000Z",
        },
      },
    };
    left.days["2026-11-02"] = {
      date: "2026-11-02",
      source: "guided",
      items: [{ id: "warmup", kind: "warmup", title: "Warm-up", done: true }],
      updatedAt: "2026-11-02T00:00:00.000Z",
    };
    expect(mergeState(left, right).days["2026-11-02"].cleared).toBe(true);
  });
});
