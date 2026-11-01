import { describe, expect, it } from "vitest";
import { activeChapterIndex, formatClock, lookupChapters, parseChapters } from "./chapters";

const sample = {
  version: 1,
  videos: {
    "drills/session-a/flow.mp4": [
      { t: 95, name: "Squat hold", note: "easy pace" },
      { t: 0, name: "Shoulder rolls" },
      { t: -3, name: "Skip me" },
      { name: "No time" },
      { t: 40, name: "   " },
    ],
  },
};

describe("parseChapters", () => {
  it("keeps valid cues, drops bad ones, and sorts by time", () => {
    const file = parseChapters(sample);
    expect(file.version).toBe(1);
    expect(file.videos["drills/session-a/flow.mp4"]).toEqual([
      { t: 0, name: "Shoulder rolls" },
      { t: 95, name: "Squat hold", note: "easy pace" },
    ]);
  });

  it("returns an empty catalog for missing or unreadable files", () => {
    for (const input of [null, undefined, "nope", [], { version: 2, videos: sample.videos }, { version: 1, videos: null }]) {
      expect(parseChapters(input).videos).toEqual({});
    }
  });

  it("keeps equal times in their original order", () => {
    const file = parseChapters({
      version: 1,
      videos: {
        "drills/session-a/flow.mp4": [
          { t: 10, name: "First" },
          { t: 10, name: "Second" },
        ],
      },
    });
    expect(file.videos["drills/session-a/flow.mp4"].map((cue) => cue.name)).toEqual(["First", "Second"]);
  });

  it("drops a blank note and ignores a non-string note", () => {
    const file = parseChapters({
      version: 1,
      videos: {
        "drills/a.mp4": [
          { t: 1, name: "Arm circles", note: "  " },
          { t: 2, name: "Hip circles", note: 4 },
        ],
      },
    });
    expect(file.videos["drills/a.mp4"]).toEqual([
      { t: 1, name: "Arm circles" },
      { t: 2, name: "Hip circles" },
    ]);
  });
});

describe("lookupChapters", () => {
  const file = parseChapters({
    version: 1,
    videos: {
      "drills/session-a/flow.mp4": [{ t: 0, name: "Exact" }],
      "/drills/other.mp4": [{ t: 4, name: "Slash" }],
    },
  });

  it("matches the library path exactly", () => {
    expect(lookupChapters(file, "drills/session-a/flow.mp4").map((cue) => cue.name)).toEqual(["Exact"]);
  });

  it("matches a normalized path when the key differs by slashes", () => {
    expect(lookupChapters(file, "drills/other.mp4").map((cue) => cue.name)).toEqual(["Slash"]);
    expect(lookupChapters(file, "\\drills\\other.mp4").map((cue) => cue.name)).toEqual(["Slash"]);
  });

  it("returns nothing when the video has no entry", () => {
    expect(lookupChapters(file, "drills/missing.mp4")).toEqual([]);
    expect(lookupChapters(null, "drills/session-a/flow.mp4")).toEqual([]);
    expect(lookupChapters(file, "")).toEqual([]);
  });
});

describe("activeChapterIndex", () => {
  const cues = parseChapters(sample).videos["drills/session-a/flow.mp4"];

  it("follows the cue that has already started", () => {
    expect(activeChapterIndex(cues, 0)).toBe(0);
    expect(activeChapterIndex(cues, 94.9)).toBe(0);
    expect(activeChapterIndex(cues, 95)).toBe(1);
    expect(activeChapterIndex(cues, 200)).toBe(1);
  });

  it("stays unset before the first cue", () => {
    expect(activeChapterIndex([{ t: 12, name: "Later" }], 0)).toBe(-1);
    expect(activeChapterIndex([], 10)).toBe(-1);
  });

  it("uses the later cue when two share a start time", () => {
    const ties = [
      { t: 10, name: "First" },
      { t: 10, name: "Second" },
    ];
    expect(activeChapterIndex(ties, 10)).toBe(1);
  });
});

describe("formatClock", () => {
  it("renders m:ss and h:mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(95)).toBe("1:35");
    expect(formatClock(600)).toBe("10:00");
    expect(formatClock(3661)).toBe("1:01:01");
    expect(formatClock(-4)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});
