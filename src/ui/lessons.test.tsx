// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupChapters, parseChapters } from "../lib/chapters";
import type { Library } from "../types";
import { AppContext, type AppModel } from "./context";
import { CourseScreen, ExerciseScreen, LibraryScreen } from "./library";
import { NotesScreen } from "./lesson";
import { parseRoute } from "./router";

const flow = "drills/session-a/flow.mp4";
const follow = "drills/session-a/follow.mp4";
const chart = "drills/session-a/chart.png";
const sheet = "drills/session-a/sheet.pdf";
const missing = "drills/session-a/missing.png";
const drill = "drills/session-b/drill.mp4";

const flowHtml = `<p>Keep <strong>this</strong></p><script>bad()</script><a href="javascript:alert(1)">x</a>`;
const notesHtml = `<p>Notes body</p><img src="${chart}" alt="Chart"><video src="${flow}"></video><script>nope()</script>`;

const chapters = parseChapters({
  version: 1,
  videos: {
    [flow]: [
      { t: 0, name: "Shoulder rolls" },
      { t: 95, name: "Squat hold", note: "easy pace" },
    ],
    [drill]: [{ t: 3, name: "Only one" }],
  },
});

const library = {
  courses: [
    {
      id: "sample-course",
      category: "Strength",
      name: "Sample course",
      tracks: [
        {
          name: "Lessons",
          exerciseIds: ["ex-1"],
          videos: [
            {
              title: "Flow",
              path: flow,
              description: "Line one\nLine two",
              html: flowHtml,
              attachments: [
                { title: "Chart", path: chart, kind: "image" },
                { title: "Sheet", path: sheet, kind: "pdf" },
                { title: "Gone", path: missing, kind: "image" },
              ],
              relatedPaths: [follow],
            },
            { title: "Follow clip", path: follow },
          ],
          items: [
            {
              kind: "text",
              title: "Session notes",
              description: "Bring a band.\nThen start.",
              html: notesHtml,
              attachments: [{ title: "Sheet", path: sheet, kind: "pdf" }],
              relatedPaths: [follow, flow],
            },
            {
              kind: "video",
              title: "Flow",
              path: flow,
              description: "Line one\nLine two",
              html: flowHtml,
              attachments: [
                { title: "Chart", path: chart, kind: "image" },
                { title: "Sheet", path: sheet, kind: "pdf" },
                { title: "Gone", path: missing, kind: "image" },
              ],
              relatedPaths: [follow],
            },
          ],
        },
        {
          name: "Practice",
          exerciseIds: ["ex-1"],
          videos: [{ title: "Drill", path: drill, description: "Hold steady.\nThen rest." }],
        },
        {
          name: "Handout",
          exerciseIds: [],
          videos: [],
          items: [{ kind: "text", title: "Setup notes", description: "Read this first.\nThen practice." }],
        },
      ],
    },
  ],
  exercises: [{ id: "ex-1", name: "Squat hold", level: 1, strengthMastery: "3x8", mobilityName: "" }],
  classes: [],
} as unknown as Library;

describe("course lessons", () => {
  let container: HTMLDivElement;
  let root: Root;
  const calls: { path: string; force?: boolean }[] = [];
  const videoSource = vi.fn(async (path: string, force?: boolean) => {
    calls.push({ path, force });
    if (path === missing) throw new Error("missing");
    return { src: `https://cdn.example/${encodeURIComponent(path)}` };
  });

  beforeEach(() => {
    calls.length = 0;
    videoSource.mockClear();
    window.location.hash = "#/today";
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function model(): AppModel {
    return {
      library,
      chaptersFor: (path: string) => lookupChapters(chapters, path),
      videoSource,
    } as unknown as AppModel;
  }

  async function render(node: ReactNode) {
    await act(async () => {
      root.render(<AppContext.Provider value={model()}>{node}</AppContext.Provider>);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function buttonText(label: string) {
    return [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(label));
  }

  it("lists text lessons, video lessons, and exercises without the related-only clips", async () => {
    await render(<LibraryScreen />);
    expect(container.textContent).toContain("6 items");
    await render(<CourseScreen id="sample-course" />);
    const labels = [...container.querySelectorAll("button strong")].map((node) => node.textContent);
    expect(labels).toEqual(["Session notes", "Flow", "L1 · Squat hold", "L1 · Squat hold", "Drill", "Setup notes"]);
    expect(container.textContent).not.toContain("Follow clip");
    expect(container.querySelector("video")).toBeNull();

    buttonText("Session notes")?.click();
    expect(parseRoute(window.location.hash)).toEqual({
      name: "notes",
      courseId: "sample-course",
      title: "Session notes",
    });
  });

  it("renders a text lesson without a video element", async () => {
    await render(<NotesScreen courseId="sample-course" title="Session notes" />);
    expect(container.querySelector("h1")?.textContent).toBe("Session notes");
    expect(container.querySelector("video")).toBeNull();
    expect(container.textContent).toContain("Notes body");
    expect(container.textContent).not.toContain("nope()");
    expect(container.textContent).not.toContain("Bring a band.");
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe(`https://cdn.example/${encodeURIComponent(chart)}`);
    expect(image?.getAttribute("src")).not.toBe(chart);
    const pdf = container.querySelector("a.attachment-file");
    expect(pdf?.textContent).toContain("Sheet");
    expect(pdf?.getAttribute("href")).toBe(`https://cdn.example/${encodeURIComponent(sheet)}`);
    expect(calls.map((call) => call.path)).toEqual([chart, sheet]);
    expect(calls.some((call) => call.path === flow)).toBe(false);

    buttonText("Follow clip")?.click();
    expect(parseRoute(window.location.hash)).toEqual({
      name: "exercise",
      id: `video:${follow}`,
      day: undefined,
      item: undefined,
    });
    expect(container.querySelector("video")).toBeNull();

    await render(<ExerciseScreen id={`video:${follow}`} />);
    expect(container.querySelector("h1")?.textContent).toBe("Follow clip");
    expect(container.querySelectorAll("video")).toHaveLength(1);
  });

  it("shows plain text when a lesson has no html", async () => {
    await render(<NotesScreen courseId="sample-course" title="Setup notes" />);
    const body = container.querySelector(".lesson-text");
    expect(body?.textContent).toBe("Read this first.\nThen practice.");
    expect(container.querySelector("video")).toBeNull();
    expect(videoSource).not.toHaveBeenCalled();
  });

  it("shows body text, attachments, related videos, and chapters on a video lesson", async () => {
    await render(<ExerciseScreen id={`video:${flow}`} />);
    expect(container.querySelector("h1")?.textContent).toBe("Flow");
    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(container.textContent).toContain("Keep this");
    expect(container.textContent).not.toContain("bad()");
    expect(container.textContent).not.toContain("Line one");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(`https://cdn.example/${encodeURIComponent(chart)}`);
    expect(container.querySelector("a.attachment-file")?.getAttribute("href")).toBe(`https://cdn.example/${encodeURIComponent(sheet)}`);
    expect(container.textContent).not.toContain("Gone");
    expect(buttonText("Follow clip")).toBeTruthy();
    expect(container.textContent).toContain("Shoulder rolls");
    expect(container.textContent).toContain("1:35");
    expect(container.textContent).toContain("easy pace");
    expect(calls.some((call) => call.path === flow)).toBe(true);
    expect(calls.some((call) => call.path === chart)).toBe(true);
    expect(calls.some((call) => call.path === missing)).toBe(true);
  });

  it("hides the chapter list when a video has fewer than two marks", async () => {
    await render(<ExerciseScreen id={`video:${drill}`} />);
    expect(container.querySelector("video")).toBeTruthy();
    expect(container.querySelector(".lesson-text")?.textContent).toBe("Hold steady.\nThen rest.");
    expect(container.textContent).not.toContain("Exercises");
    expect(container.textContent).not.toContain("Only one");
    expect(container.querySelector(".chapter-jump")).toBeNull();
  });
});
