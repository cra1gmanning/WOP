// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupChapters, parseChapters } from "../lib/chapters";
import type { LessonExercise } from "../types";
import { AppContext, type AppModel } from "./context";
import { VideoPane } from "./widgets";

const file = parseChapters({
  version: 1,
  videos: {
    "drills/session-a/flow.mp4": [
      { t: 0, name: "Shoulder rolls" },
      { t: 95, name: "Squat hold", note: "easy pace" },
    ],
    "drills/one.mp4": [{ t: 3, name: "Only one" }],
    "drills/week-1/block.mp4": [
      { t: 0, name: "Hip Circles" },
      { t: 30, name: "Wall Slides", note: "slow reach" },
      { t: 90, name: "Squat hold" },
    ],
  },
});

const flowPath = "drills/session-a/flow.mp4";

describe("exercise bookmarks on the player", () => {
  let container: HTMLDivElement;
  let root: Root;
  const calls: { path: string; force: boolean | undefined }[] = [];
  const videoSource = vi.fn(async (path: string, force?: boolean) => {
    calls.push({ path, force });
    const src = force ? `https://cdn.example/fresh-${calls.length}.mp4` : "https://cdn.example/first.mp4";
    return { src };
  });

  beforeEach(() => {
    calls.length = 0;
    videoSource.mockClear();
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
      chaptersFor: (path: string) => lookupChapters(file, path),
      videoSource,
    } as unknown as AppModel;
  }

  async function renderPane(path: string, exercises?: LessonExercise[]) {
    await act(async () => {
      root.render(
        <AppContext.Provider value={model()}>
          <VideoPane path={path} title="Flow" exercises={exercises} />
        </AppContext.Provider>,
      );
    });
  }

  async function setDuration(seconds: number) {
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { configurable: true, value: seconds });
    await act(async () => {
      video.dispatchEvent(new Event("loadedmetadata"));
    });
    return video;
  }

  function jumpButtons() {
    return [...container.querySelectorAll("button.chapter-jump")] as HTMLButtonElement[];
  }

  it("skips the chapter list when a video has only one mark", async () => {
    await renderPane("drills/one.mp4");
    expect(container.querySelector("video")).toBeTruthy();
    expect(container.textContent).not.toContain("Exercises");
    expect(container.textContent).not.toContain("Only one");
    expect(container.textContent).not.toContain("Hide video");
  });

  it("renders nothing extra when the video has no entry", async () => {
    await renderPane("clips/no-bookmarks.mp4");
    expect(container.querySelector("video")).toBeTruthy();
    expect(container.textContent).not.toContain("Exercises");
    expect(container.textContent).not.toContain("Hide video");
    expect(container.querySelector(".path")?.textContent).toBe("clips/no-bookmarks.mp4");
    expect(videoSource).toHaveBeenCalledOnce();
  });

  it("highlights the current exercise, seeks on tap, and seeks again after a fresh playback link", async () => {
    await renderPane(flowPath);
    const video = () => container.querySelector("video") as HTMLVideoElement;
    expect(video()).toBeTruthy();
    expect(jumpButtons()[0].closest("li")?.textContent).toContain("0:00");
    expect(jumpButtons()[0].textContent).toContain("Shoulder rolls");
    expect(jumpButtons()[0].textContent).toContain("Now");
    expect(jumpButtons()[1].closest("li")?.textContent).toContain("1:35");
    expect(jumpButtons()[1].textContent).toContain("Squat hold");
    expect(jumpButtons()[1].textContent).toContain("easy pace");
    expect(jumpButtons()[1].closest("li")?.getAttribute("aria-current")).toBeNull();

    await act(async () => {
      jumpButtons()[1].click();
    });
    expect(video().currentTime).toBe(0);
    await act(async () => {
      video().dispatchEvent(new Event("loadedmetadata"));
    });
    expect(video().currentTime).toBe(95);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(jumpButtons()[1].textContent).toContain("Now");
    expect(jumpButtons()[1].closest("li")?.getAttribute("aria-current")).toBe("true");
    expect(jumpButtons()[0].textContent).not.toContain("Now");

    const mark = container.querySelector('button[aria-label="Mark Squat hold done"]') as HTMLButtonElement;
    await act(async () => {
      mark.click();
    });
    expect(mark.getAttribute("aria-pressed")).toBe("true");
    expect(video().currentTime).toBe(95);

    await act(async () => {
      video().dispatchEvent(new Event("error"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calls.some((call) => call.force === true && call.path === flowPath)).toBe(true);
    expect(video().getAttribute("src")).toContain("fresh-");
    await act(async () => {
      video().dispatchEvent(new Event("loadedmetadata"));
    });
    expect(video().currentTime).toBe(95);
    expect(jumpButtons()[1].textContent).toContain("Now");

    const hide = [...container.querySelectorAll("button")].find((button) => button.textContent === "Hide video") as HTMLButtonElement;
    await act(async () => {
      hide.click();
    });
    expect(container.querySelector(".video-slot")?.hasAttribute("hidden")).toBe(true);
    expect(container.textContent).toContain("Squat hold");
    expect(container.textContent).toContain("Show video");

    await act(async () => {
      jumpButtons()[0].click();
    });
    expect(container.querySelector(".video-slot")?.hasAttribute("hidden")).toBe(false);
    await act(async () => {
      video().dispatchEvent(new Event("loadedmetadata"));
    });
    expect(video().currentTime).toBe(0);
    expect(jumpButtons()[0].textContent).toContain("Now");
  });

  it("lists doses and cues, and seeks from a timed row", async () => {
    const exercises: LessonExercise[] = [
      { name: "Hip Circles", dose: "2 sets of 10 reps each side", cue: "Keep the ribs quiet", t: 0, label: "A1" },
      { name: "Wall Slides", dose: "1x60sec", cue: "Long slow reach", t: 65, label: "A2" },
      { name: "Squat hold", dose: "3 sets of 20 seconds", cue: "Heels stay down", t: 180 },
      { name: "Easy walk", dose: "2 minutes", cue: "Shake the legs out" },
    ];
    await renderPane("drills/week-1/day-1.mp4", exercises);
    const items = [...container.querySelectorAll(".chapter-list li")];
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain("A1");
    expect(items[0].textContent).toContain("Hip Circles");
    expect(items[0].textContent).toContain("2 sets of 10 reps each side");
    expect(items[1].querySelector(".chapter-cue")?.getAttribute("title")).toBe("Long slow reach");
    expect(items[3].querySelector("button.chapter-jump")).toBeNull();
    expect(items[3].querySelector(".chapter-static")?.tagName).toBe("DIV");
    expect(items[3].textContent).toContain("Easy walk");
    expect(items[3].querySelector(".chapter-time")).toBeNull();
    expect(container.textContent).toContain("Tap an exercise to jump there.");

    const video = container.querySelector("video") as HTMLVideoElement;
    await act(async () => {
      jumpButtons()[1].click();
    });
    await act(async () => {
      video.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(video.currentTime).toBe(65);
    expect(jumpButtons()[1].textContent).toContain("Now");
  });

  it("builds the list and ticks from chapters when the video has no exercises", async () => {
    await renderPane("drills/week-1/block.mp4");
    expect([...container.querySelectorAll(".chapter-list li")]).toHaveLength(3);
    expect(container.textContent).toContain("slow reach");
    const video = await setDuration(300);
    const ticks = [...container.querySelectorAll("button.cue-tick")] as HTMLButtonElement[];
    expect(ticks.map((tick) => Number.parseFloat(tick.style.left))).toEqual([0, 10, 30]);
    await act(async () => {
      ticks[1].click();
    });
    await act(async () => {
      video.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(video.currentTime).toBe(30);
    expect(container.querySelector(".cue-bubble.is-open")?.textContent).toContain("Wall Slides");
  });

  it("shows one dose card and no rail for a single untimed exercise", async () => {
    await renderPane("drills/week-1/clip.mp4", [{ name: "Hip Circles", dose: "1x60sec", cue: "Keep the ribs quiet" }]);
    expect(container.querySelectorAll(".chapter-list li")).toHaveLength(1);
    expect(container.querySelector(".chapter-jump")).toBeNull();
    expect(container.querySelector(".chapter-hint")).toBeNull();
    expect(container.querySelector(".cue-rail")).toBeNull();
    expect(container.textContent).not.toContain("Hide video");
    await setDuration(90);
    expect(container.querySelector(".cue-rail")).toBeNull();
  });

  it("omits ticks that start after the video ends", async () => {
    await renderPane("drills/week-1/day-1.mp4", [
      { name: "Hip Circles", t: 0 },
      { name: "Wall Slides", t: 65 },
      { name: "Late march", t: 900 },
    ]);
    await setDuration(600);
    const ticks = [...container.querySelectorAll("button.cue-tick")] as HTMLButtonElement[];
    expect(ticks).toHaveLength(2);
    expect(ticks[1].style.left).toBe(`${(65 / 600) * 100}%`);
    expect(ticks.some((tick) => tick.getAttribute("aria-label")?.includes("Late march"))).toBe(false);
    await act(async () => {
      ticks[1].click();
    });
    expect(container.querySelector(".cue-bubble.is-open")?.textContent).toContain("Wall Slides");
  });
});
