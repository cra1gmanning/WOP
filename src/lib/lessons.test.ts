import { describe, expect, it } from "vitest";
import type { CourseTrack, Library } from "../types";
import { findTextLesson, findVideoLesson, trackRows, videoTitle } from "./lessons";
import { parseRoute, routeHash } from "../ui/router";

const flow = "drills/session-a/flow.mp4";
const follow = "drills/session-a/follow.mp4";

function track(partial: Partial<CourseTrack> & Pick<CourseTrack, "name">): CourseTrack {
  return {
    exerciseIds: [],
    videos: [],
    ...partial,
  };
}

describe("trackRows", () => {
  it("renders items in order and keeps exercises that are not in that list", () => {
    const rows = trackRows(track({
      name: "Lessons",
      exerciseIds: ["ex-1", "ex-1"],
      videos: [
        { title: "Flow", path: flow },
        { title: "Follow clip", path: follow },
      ],
      items: [
        { kind: "text", title: "Session notes", path: "drills/ignored.mp4" },
        { kind: "video", title: "Flow", path: flow, extra: true },
        { kind: "other", title: "Skip" },
      ] as unknown as CourseTrack["items"],
    }));
    expect(rows).toEqual([
      { kind: "text", title: "Session notes" },
      { kind: "video", title: "Flow", path: flow },
      { kind: "exercise", id: "ex-1" },
    ]);
    expect(JSON.stringify(rows)).not.toContain("ignored.mp4");
    expect(JSON.stringify(rows)).not.toContain(follow);
  });

  it("falls back to exercises and videos when items are missing or unusable", () => {
    const legacy = trackRows(track({
      name: "Practice",
      exerciseIds: ["ex-1"],
      videos: [{ title: "Drill", path: "drills/session-b/drill.mp4" }],
    }));
    expect(legacy).toEqual([
      { kind: "exercise", id: "ex-1" },
      { kind: "video", title: "Drill", path: "drills/session-b/drill.mp4" },
    ]);

    const broken = trackRows(track({
      name: "Practice",
      videos: [{ title: "Drill", path: "drills/session-b/drill.mp4" }, { title: "No path", path: "  " }],
      items: [{ kind: "video", title: "Missing path" }] as never,
    }));
    expect(broken).toEqual([{ kind: "video", title: "Drill", path: "drills/session-b/drill.mp4" }]);
  });

  it("shows a text-only track without inventing a video row", () => {
    const rows = trackRows(track({
      name: "Handout",
      items: [{ kind: "text", title: "Setup notes", description: "Read this first.\nThen practice." }],
    }));
    expect(rows).toEqual([{ kind: "text", title: "Setup notes" }]);
  });
});

describe("lesson lookup", () => {
  const library = {
    courses: [
      {
        id: "sample-course",
        name: "Sample course",
        category: "Strength",
        tracks: [
          track({
            name: "Lessons",
            videos: [
              { title: "Flow", path: flow, description: "short" },
              { title: "Follow clip", path: follow },
            ],
            items: [
              {
                kind: "text",
                title: "Session notes",
                html: "<p>Notes body</p>",
                relatedPaths: [follow, flow],
              },
              {
                kind: "video",
                title: "Flow",
                path: flow,
                html: "<p>Keep this</p>",
                attachments: [{ title: "Chart", path: "drills/session-a/chart.png", kind: "image" }],
                relatedPaths: [follow],
              },
            ],
          }),
        ],
      },
    ],
  } as unknown as Library;

  it("finds a text lesson by course and title", () => {
    const notes = findTextLesson(library, "sample-course", "Session notes");
    expect(notes?.kind).toBe("text");
    expect(notes?.path).toBeUndefined();
    expect(notes?.relatedPaths).toEqual([follow, flow]);
    expect(findTextLesson(library, "sample-course", "Missing")).toBeNull();
  });

  it("prefers the video item that carries the lesson body", () => {
    const lesson = findVideoLesson(library, `/${flow}`);
    expect(lesson?.title).toBe("Flow");
    expect(lesson?.html).toContain("Keep this");
    expect(lesson?.attachments.map((item) => item.kind)).toEqual(["image"]);
    expect(videoTitle(library, follow)).toBe("Follow clip");
    expect(videoTitle(library, "drills/missing.mp4")).toBe("missing");
  });
});

describe("notes route", () => {
  it("round-trips a course id and title", () => {
    const route = { name: "notes" as const, courseId: "sample-course", title: "Session notes / a & b" };
    expect(parseRoute(routeHash(route))).toEqual(route);
  });
});
