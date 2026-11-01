import { describe, expect, it } from "vitest";
import { advanceSlot, deriveGuidedDay, resolveDay, seedSlots } from "./workout";
import { createState } from "../state/default";
import { ladderFromMastery } from "./ladders";
import type { Exercise, Library } from "../types";

function exercise(partial: Partial<Exercise> & Pick<Exercise, "id" | "name" | "track" | "slotKey">): Exercise {
  return {
    category: "Strength",
    course: "Level 1",
    level: 1,
    order: 1,
    strengthMastery: "5x15r",
    mobilityMastery: "5x5r",
    mobilityName: "Drill",
    steps: ladderFromMastery("5x15r"),
    focus: { strength: [], mobility: [] },
    videos: { strength: `${partial.id}-s.mp4`, mobility: [`${partial.id}-m.mp4`], tech: [] },
    ...partial,
  };
}

function library(): Library {
  const exercises = [
    exercise({ id: "HBP/PE1", name: "Incline Pushup", track: "Hollow Back Press", slotKey: "upper.A", mobilityName: "German Arm Swing" }),
    exercise({ id: "HBP/PE2", name: "Pushup", track: "Hollow Back Press", slotKey: "upper.A", order: 2, level: 1 }),
    exercise({ id: "RC/PE1", name: "Incline Row", track: "Rope Climb", slotKey: "upper.B" }),
    exercise({ id: "sPL/PE1", name: "Scapular Shrugs", track: "Straddle Planche", slotKey: "upper.C" }),
    exercise({ id: "FL/PE1", name: "Bent Hollow Body Hold", track: "Front Lever", slotKey: "core.A", strengthMastery: "5x60s", steps: ladderFromMastery("5x60s") }),
    exercise({ id: "SL/PE1", name: "Seated Russian Twist", track: "Side Lever", slotKey: "core.B" }),
    exercise({ id: "MN/PE1", name: "Tuck-Up", track: "Manna", slotKey: "core.C" }),
    exercise({ id: "SLS/PE1", name: "Assisted Squat", track: "Single Leg Squat", slotKey: "lower.A" }),
  ];
  return {
    version: 1,
    generatedAt: "2026-11-01T00:00:00.000Z",
    rootFolder: "Workouts",
    exercises,
    courses: [],
    classes: [],
    quiz: { intro: "", questions: [], levels: [], blurbs: {}, blurbSources: {} },
    habits: { overview: "", tasks: [], lessons: [] },
    equipment: [],
    media: {
      warmups: [
        { title: "7 Minute Warm-Up", path: "warm/7.mp4" },
        { title: "Extended Warmup", path: "warm/ext.mp4" },
      ],
      mobility: [
        { title: "Weighted Mobility", path: "mob/w.mp4" },
        { title: "Knee Series", path: "mob/k.mp4" },
        { title: "Single Bar Shoulder Mobility", path: "mob/s.mp4" },
      ],
      stretches: {
        front: { title: "Front Split", path: "stretch/front.mp4" },
        middle: { title: "Middle Split", path: "stretch/middle.mp4" },
        extra: [],
      },
    },
    plans: {
      beginner: { id: "beginner", name: "Beginner", summary: "", workouts: [] },
      guided: [
        { id: "intermediate-one", name: "Intermediate One", warmupTitle: "7 Minute Warm-Up", startLevel: 1, summary: "" },
        { id: "intermediate-two", name: "Intermediate Two", warmupTitle: "Extended Warmup", startLevel: 2, summary: "" },
        { id: "advanced-one", name: "Advanced One", warmupTitle: "Extended Warmup", startLevel: 3, summary: "" },
        { id: "advanced-two", name: "Advanced Two", warmupTitle: "Extended Warmup", startLevel: 4, summary: "" },
      ],
      week: [
        { dow: 1, label: "Monday", dayType: "upper", mobilityTitle: "Weighted Mobility" },
        { dow: 2, label: "Tuesday", dayType: "core-lower", mobilityTitle: "Knee Series" },
        { dow: 3, label: "Wednesday", dayType: "stretch-front" },
        { dow: 4, label: "Thursday", dayType: "upper", mobilityTitle: "Single Bar Shoulder Mobility" },
        { dow: 5, label: "Friday", dayType: "core-lower", mobilityTitle: "Knee Series" },
        { dow: 6, label: "Saturday", dayType: "stretch-middle" },
        { dow: 0, label: "Sunday", dayType: "upper", mobilityTitle: "Weighted Mobility" },
      ],
      dayTypes: [
        { id: "upper", label: "Upper Body", slots: ["upper.A", "upper.B", "upper.C"] },
        { id: "core-lower", label: "Core / Lower Body", slots: ["core.A", "core.B", "core.C", "lower.A"] },
        { id: "core-upper", label: "Core / Upper Body", slots: ["core.A", "core.B", "core.C", "upper.A", "upper.B", "upper.C"] },
        { id: "stretch-front", label: "Front Split", slots: [], stretch: "front" },
        { id: "stretch-middle", label: "Middle Split", slots: [], stretch: "middle" },
      ],
      slots: [
        { key: "upper.A", block: "Upper Body", letter: "A", track: "Hollow Back Press", endSkill: "Hollow Back Press" },
        { key: "upper.B", block: "Upper Body", letter: "B", track: "Rope Climb", endSkill: "Rope Climb" },
        { key: "upper.C", block: "Upper Body", letter: "C", track: "Straddle Planche", endSkill: "Straddle Planche" },
        { key: "core.A", block: "Core", letter: "A", track: "Front Lever", endSkill: "Front Lever" },
        { key: "core.B", block: "Core", letter: "B", track: "Side Lever", endSkill: "Side Lever" },
        { key: "core.C", block: "Core", letter: "C", track: "Manna", endSkill: "Manna" },
        { key: "lower.A", block: "Lower Body", letter: "A", track: "Single Leg Squat", endSkill: "Single Leg Squat" },
      ],
    },
  };
}

describe("guided days", () => {
  it("builds Monday upper body and Wednesday front split", () => {
    const lib = library();
    const state = createState("2026-11-02T00:00:00.000Z");
    state.meta.planId = "intermediate-one";
    state.slots = seedSlots(lib, "intermediate-one", "2026-11-02T00:00:00.000Z");
    const monday = resolveDay(lib, state, "2026-11-02", "2026-11-02");
    expect(monday.headline).toBe("Upper Body");
    expect(monday.items.map((item) => item.title)).toEqual([
      "7 Minute Warm-Up",
      "Weighted Mobility",
      "A Incline Pushup",
      "B Incline Row",
      "C Scapular Shrugs",
    ]);
    expect(monday.items[2].prescription).toBe("3x3r");
    const wednesday = deriveGuidedDay(lib, state, "2026-10-28");
    expect(wednesday.items.map((item) => item.title)).toEqual(["Front Split"]);
  });

  it("shows a past unlogged day as rest and keeps a beginner day empty until generated", () => {
    const lib = library();
    const state = createState("2026-11-02T00:00:00.000Z");
    state.meta.planId = "intermediate-one";
    expect(resolveDay(lib, state, "2026-11-01", "2026-11-02").headline).toBe("Rest day");
    state.meta.planId = "beginner";
    expect(resolveDay(lib, state, "2026-11-02", "2026-11-02").headline).toMatch(/doesn't have a workout/);
  });

  it("advances the step, then the next progression after step 9", () => {
    const lib = library();
    const track = lib.exercises.filter((item) => item.slotKey === "upper.A");
    expect(advanceSlot(track, { exerciseId: "HBP/PE1", step: 1 }, false)).toMatchObject({ exerciseId: "HBP/PE1", step: 2 });
    expect(advanceSlot(track, { exerciseId: "HBP/PE1", step: 9 }, false)).toMatchObject({ exerciseId: "HBP/PE2", step: 1 });
    expect(advanceSlot(track, { exerciseId: "HBP/PE1", step: 9 }, true)).toMatchObject({ exerciseId: "HBP/PE1", step: 9, mastered: false });
  });
});
