// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupChapters, parseChapters } from "../lib/chapters";
import { AppContext, type AppModel } from "./context";
import { VideoPane } from "./widgets";

const file = parseChapters({
  version: 1,
  videos: {
    "drills/session-a/flow.mp4": [
      { t: 0, name: "Shoulder rolls" },
      { t: 95, name: "Squat hold", note: "easy pace" },
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

  async function renderPane(path: string) {
    await act(async () => {
      root.render(
        <AppContext.Provider value={model()}>
          <VideoPane path={path} title="Flow" />
        </AppContext.Provider>,
      );
    });
  }

  function jumpButtons() {
    return [...container.querySelectorAll("button.chapter-jump")] as HTMLButtonElement[];
  }

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
    expect(jumpButtons()[0].textContent).toContain("0:00");
    expect(jumpButtons()[0].textContent).toContain("Shoulder rolls");
    expect(jumpButtons()[0].textContent).toContain("Now");
    expect(jumpButtons()[1].textContent).toContain("1:35");
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
});
