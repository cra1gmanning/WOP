import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scoreQuiz } from "../src/lib/quiz";
import { assertClean, generateLibrary, levelIdFromLabel, parsePlacementResults } from "./generate-library";

const CAPTURE = process.env.LIBRARY_SPEC || "";

const MINI_QUIZ = `
This quiz is just meant to place you at a starting point.
1. "Upper 1" – pushing:
   0: knees | 1: push-ups
2. "Upper 2" – pulling:
   0: none | 1: hang
3. "Core 1" – lever:
   0: none | 1: hollow
4. "Core 2" – side:
   0: twist | 1: arch
5. "Core 3" – compression:
   0: none | 1: tuck
6. "Mobility 1" – pike:
   0: toes | 1: fold
7. "Mobility 2" – bridge:
   0: none | 1: bridge
mobility 0 => "We won't sugar coat it, mobility should be your training priority right now."
core strong => "Shoot dang, your core is strong."
strength high => "Your strength is impressive."
low => "We'll begin with gentle strength work that rejuvenates your movement."
all 3 high => "Outstanding! Your focus on mobility is about to pay off."
Beginner: "Now is the time to address your fitness deficits."
Intermediate One: "Intermediate One combines warm-ups, active mobility, and injury prevention."
`;

describe("generator", () => {
  it("strips source URLs from a tiny catalog", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "library-spec-"));
    fs.mkdirSync(path.join(dir, "planner"), { recursive: true });
    fs.mkdirSync(path.join(dir, "content"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "Catalog.csv"),
      [
        "Category,Course/Level,Skill Track,Progression #,Progression Name,Code,Strength Mastery,Mobility Mastery,Focus Points,Video Type,File Path,Source URL,Status",
        'Strength,Level 1,Hollow Back Press,2,Pushup,HBP/PE2,5x15r,5x5r,"Strength: 1) Ribs down.",Mobility,01 Level/push-m.mp4,https://example.invalid/secret.mp4,OK',
        'Strength,Level 1,Hollow Back Press,2,Pushup,HBP/PE2,5x15r,5x5r,"Strength: 1) Ribs down.",Strength,01 Level/push-s.mp4,https://example.invalid/nope,OK',
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(dir, "Classes.csv"),
      "Difficulty,Type,Duration,Minutes,Title,Part,Description,File Path,Source URL,Status,Shared Video\nBeginner,Warmup,Short,7,7 Minute Warm-Up,,,Classes/7 Minute Warm-Up.mp4,https://example.com/x,OK,\n",
    );
    fs.writeFileSync(path.join(dir, "embedded.json"), JSON.stringify({
      "Level 1": {
        "Hollow Back Press": [{
          element: "HBP/PE2",
          imName: "Xiaopeng Forward",
          exercisesFocusPoints: { strength: [{ description: "Ribs down." }], mobility: [{ description: "Reach." }] },
          exercisesVideos: { strength: [{ mp4: "https://cdn.example.invalid/hidden.mp4" }] },
        }],
      },
    }));
    fs.writeFileSync(path.join(dir, "planner/2_placement_quiz.md"), MINI_QUIZ);
    fs.writeFileSync(path.join(dir, "content/quiz.md"), "This quiz is just meant to place you at a starting point.");
    const { library } = generateLibrary(dir, "2026-11-01T00:00:00.000Z");
    assertClean(library);
    const push = library.exercises.find((item) => item.id === "HBP/PE2");
    expect(push?.mobilityName).toBe("Xiaopeng Forward");
    expect(push?.steps[5].label).toBe("5x9r");
    expect(push?.videos.strength).toBe("01 Level/push-s.mp4");
    expect(JSON.stringify(library)).not.toMatch(/https?:\/\//i);
  });

  it.skipIf(!CAPTURE || !fs.existsSync(path.join(CAPTURE, "Catalog.csv")))("builds an external library without remote URLs", () => {
    const { library, warnings } = generateLibrary(CAPTURE, "2026-11-01T00:00:00.000Z");
    expect(warnings).toEqual([]);
    expect(library.plans.beginner.workouts).toHaveLength(40);
    expect(library.plans.beginner.workouts[0].items[0].path).toMatch(/7 Minute Warm-Up\.mp4$/);
    expect(library.plans.beginner.workouts[39].items.map((item) => item.title)).toContain("Total Body Conditioning");
    const hollow = library.exercises.find((item) => item.id === "FL/PE1");
    expect(hollow?.steps.map((step) => step.label)).toEqual([
      "3x12s", "5x12s", "3x24s", "4x24s", "4x36s", "5x36s", "4x48s", "4x60s", "5x60s",
    ]);
    expect(hollow?.mobilityName).toBe("Cat-Cow");
    const push = library.exercises.find((item) => item.id === "HBP/PE2");
    expect(push?.steps[5].label).toBe("5x9r");
    expect(library.quiz.questions).toHaveLength(7);
    expect(library.habits.tasks).toHaveLength(19);
    expect(library.classes.some((item) => item.title === "Extended Warmup")).toBe(true);
    const results = parsePlacementResults(fs.readFileSync(path.join(CAPTURE, "planner/2_placement_quiz.md"), "utf8"));
    expect(results.length).toBeGreaterThanOrEqual(13);
    for (const row of results) {
      expect(scoreQuiz(row.answers)).toBe(levelIdFromLabel(row.label));
    }
    assertClean(library);
    const slots = new Set(library.exercises.map((item) => item.slotKey).filter(Boolean));
    expect(slots.size).toBe(7);
  });
});
