import { describe, expect, it } from "vitest";
import { buildExerciseRows, readLessonExercises, readSummaryLine, timedRows } from "./exerciseCues";

describe("readLessonExercises", () => {
  it("drops bad entries, trims text, and floors times", () => {
    const rows = readLessonExercises([
      null,
      { name: "   " },
      { name: "Nope", t: -1 },
      { name: "Wall Slides", t: "4", dose: 2 },
      { name: "  Hip Circles  ", dose: "  ", cue: "  ribs quiet  ", label: " A1 ", t: 10.9 },
    ]);
    expect(rows).toEqual([
      { name: "Nope" },
      { name: "Wall Slides" },
      { name: "Hip Circles", cue: "ribs quiet", label: "A1", t: 10 },
    ]);
  });

  it("keeps at most 60 exercises and caps the summary", () => {
    const rows = readLessonExercises(Array.from({ length: 61 }, (_, index) => ({ name: `Move ${index}`, t: index })));
    expect(rows).toHaveLength(60);
    expect(rows?.[59].name).toBe("Move 59");
    expect(readSummaryLine(`  ${"a".repeat(250)}  `)).toHaveLength(240);
    expect(readSummaryLine("   ")).toBeUndefined();
  });
});

describe("buildExerciseRows", () => {
  const chapters = [
    { t: 0, name: "Shoulder rolls" },
    { t: 40, name: "Hip Circles", note: "easy pace" },
    { t: 90, name: "Wall Slides" },
  ];

  it("falls back to chapters when exercises are empty or have fewer timed rows", () => {
    expect(buildExerciseRows([], chapters).map((row) => ({ name: row.name, t: row.t, cue: row.cue }))).toEqual([
      { name: "Shoulder rolls", t: 0, cue: undefined },
      { name: "Hip Circles", t: 40, cue: "easy pace" },
      { name: "Wall Slides", t: 90, cue: undefined },
    ]);
    expect(buildExerciseRows([{ name: "Easy walk" }], chapters).map((row) => row.name)).toEqual([
      "Shoulder rolls",
      "Hip Circles",
      "Wall Slides",
    ]);
  });

  it("keeps library order, including an untimed closer, when timed rows cover the chapters", () => {
    const rows = buildExerciseRows([
      { name: "Later", t: 30 },
      { name: "Close" },
      { name: "Earlier", t: 5 },
    ], [{ t: 0, name: "Shoulder rolls" }]);
    expect(rows.map((row) => row.name)).toEqual(["Later", "Close", "Earlier"]);
    expect(timedRows(rows).map((row) => row.name)).toEqual(["Earlier", "Later"]);
  });

  it("dedupes identical times and keeps the earlier row", () => {
    const rows = buildExerciseRows([
      { name: "First", t: 10 },
      { name: "Second", t: 10 },
      { name: "Third", t: 12 },
    ], []);
    expect(timedRows(rows).map((row) => row.name)).toEqual(["First", "Third"]);
  });
});
