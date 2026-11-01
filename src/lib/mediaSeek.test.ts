import { describe, expect, it, vi } from "vitest";
import { applyMediaSeek, initialSeekMachine, reduceSeek, type SeekableMedia, type SeekMachine } from "./mediaSeek";

function run(events: Parameters<typeof reduceSeek>[1][], start: SeekMachine = initialSeekMachine()) {
  const steps: { apply: number | null; refresh: boolean; machine: SeekMachine }[] = [];
  let machine = start;
  for (const event of events) {
    const decision = reduceSeek(machine, event);
    machine = decision.machine;
    steps.push({ apply: decision.apply, refresh: decision.refresh, machine });
  }
  return steps;
}

describe("reduceSeek", () => {
  it("applies a bookmark tap immediately", () => {
    const [step] = run([{ type: "tap", seconds: 95 }]);
    expect(step.apply).toBe(95);
    expect(step.refresh).toBe(false);
    expect(step.machine.pending).toBe(95);
  });

  it("keeps the tapped time when a stale playhead reports 0 before the seek lands", () => {
    const steps = run([
      { type: "tap", seconds: 95 },
      { type: "time", seconds: 0 },
      { type: "error" },
    ]);
    expect(steps[1].machine.pending).toBe(95);
    expect(steps[2].refresh).toBe(true);
    expect(steps[2].machine.pending).toBe(95);
    expect(steps[2].apply).toBeNull();
  });

  it("reapplies the same time after a fresh Graph download URL is mounted", () => {
    const steps = run([
      { type: "tap", seconds: 95 },
      { type: "error" },
      { type: "url-mounted" },
    ]);
    expect(steps[1].refresh).toBe(true);
    expect(steps[2].apply).toBe(95);
    expect(steps[2].refresh).toBe(false);
    expect(steps[2].machine.awaitingUrl).toBe(false);
  });

  it("does not request a second URL when the fresh link also fails", () => {
    const steps = run([
      { type: "tap", seconds: 95 },
      { type: "error" },
      { type: "url-mounted" },
      { type: "error" },
    ]);
    expect(steps[3].refresh).toBe(false);
    expect(steps[3].machine.refreshes).toBe(1);
  });

  it("ignores an error from the element that is being replaced", () => {
    const steps = run([
      { type: "tap", seconds: 95 },
      { type: "error" },
      { type: "error" },
    ]);
    expect(steps[1].refresh).toBe(true);
    expect(steps[2].refresh).toBe(false);
  });

  it("allows another refresh after the next tap", () => {
    const steps = run([
      { type: "tap", seconds: 95 },
      { type: "error" },
      { type: "url-mounted" },
      { type: "error" },
      { type: "tap", seconds: 10 },
      { type: "error" },
    ]);
    expect(steps[4].apply).toBe(10);
    expect(steps[4].machine.refreshes).toBe(0);
    expect(steps[5].refresh).toBe(true);
    expect(steps[5].machine.pending).toBe(10);
  });

  it("restores the playhead when the link expires during playback", () => {
    const steps = run([
      { type: "time", seconds: 40 },
      { type: "error" },
      { type: "url-mounted" },
    ]);
    expect(steps[1].refresh).toBe(true);
    expect(steps[1].machine.pending).toBe(40);
    expect(steps[2].apply).toBe(40);
  });

  it("can refresh again after playback moves on from a recovered seek", () => {
    const steps = run([
      { type: "time", seconds: 40 },
      { type: "error" },
      { type: "url-mounted" },
      { type: "seeked", seconds: 40 },
      { type: "error" },
      { type: "time", seconds: 41.2 },
      { type: "error" },
    ]);
    expect(steps[4].refresh).toBe(false);
    expect(steps[6].refresh).toBe(true);
    expect(steps[6].machine.pending).toBe(41.2);
  });

  it("ignores a seeked event that has not reached the bookmark yet", () => {
    const steps = run([
      { type: "tap", seconds: 95 },
      { type: "seeked", seconds: 0 },
      { type: "seeked", seconds: 95.2 },
    ]);
    expect(steps[1].machine.pending).toBe(95);
    expect(steps[2].machine.pending).toBeNull();
    expect(steps[2].machine.resumeAt).toBe(95.2);
  });
});

describe("applyMediaSeek", () => {
  function fake(readyState: number) {
    const listeners = new Set<() => void>();
    const video = {
      readyState,
      currentTime: 0,
      play: vi.fn(() => Promise.resolve()),
      addEventListener(_type: "loadedmetadata", listener: () => void) {
        listeners.add(listener);
      },
      removeEventListener(_type: "loadedmetadata", listener: () => void) {
        listeners.delete(listener);
      },
      emit() {
        for (const listener of [...listeners]) listener();
      },
    };
    return video;
  }

  it("waits for metadata before seeking a Graph URL that is not ready", () => {
    const video = fake(0);
    applyMediaSeek(video, 95);
    expect(video.currentTime).toBe(0);
    expect(video.play).not.toHaveBeenCalled();
    video.emit();
    expect(video.currentTime).toBe(95);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it("keeps only the latest seek if metadata has not arrived", () => {
    const video = fake(0);
    applyMediaSeek(video, 10);
    applyMediaSeek(video, 95);
    video.emit();
    expect(video.currentTime).toBe(95);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it("seeks and plays as soon as metadata is already available", () => {
    const video = fake(1);
    applyMediaSeek(video, 95);
    expect(video.currentTime).toBe(95);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it("swallows a play() rejection", async () => {
    const video: SeekableMedia = {
      readyState: 1,
      currentTime: 0,
      play: () => Promise.reject(new Error("blocked")),
      addEventListener() {},
      removeEventListener() {},
    };
    applyMediaSeek(video, 12);
    await Promise.resolve();
    expect(video.currentTime).toBe(12);
  });
});
