/**
 * Seeks on a media element whose src may be a short-lived Graph download URL.
 * A failed seek asks for a new URL once, then applies the same timestamp.
 * Playback that keeps moving, or another tap, can refresh again.
 */

export interface SeekMachine {
  resumeAt: number;
  pending: number | null;
  refreshes: number;
  awaitingUrl: boolean;
}

export interface SeekDecision {
  machine: SeekMachine;
  apply: number | null;
  refresh: boolean;
}

export type SeekEvent =
  | { type: "tap"; seconds: number }
  | { type: "time"; seconds: number }
  | { type: "seeked"; seconds: number }
  | { type: "error" }
  | { type: "url-mounted" };

export const SEEK_REFRESH_LIMIT = 1;
const SEEK_EPSILON = 0.75;
const PASSIVE_RESET_SECONDS = 1;

export function initialSeekMachine(): SeekMachine {
  return { resumeAt: 0, pending: null, refreshes: 0, awaitingUrl: false };
}

export function reduceSeek(machine: SeekMachine, event: SeekEvent): SeekDecision {
  if (event.type === "tap") {
    return {
      machine: { resumeAt: event.seconds, pending: event.seconds, refreshes: 0, awaitingUrl: false },
      apply: event.seconds,
      refresh: false,
    };
  }

  if (event.type === "time") {
    if (machine.pending != null) return { machine, apply: null, refresh: false };
    const refreshes = Math.abs(event.seconds - machine.resumeAt) >= PASSIVE_RESET_SECONDS ? 0 : machine.refreshes;
    if (event.seconds === machine.resumeAt && refreshes === machine.refreshes) {
      return { machine, apply: null, refresh: false };
    }
    return {
      machine: { ...machine, resumeAt: event.seconds, refreshes },
      apply: null,
      refresh: false,
    };
  }

  if (event.type === "seeked") {
    if (machine.pending != null && Math.abs(event.seconds - machine.pending) > SEEK_EPSILON) {
      return { machine, apply: null, refresh: false };
    }
    return {
      machine: { ...machine, pending: null, resumeAt: event.seconds, awaitingUrl: false },
      apply: null,
      refresh: false,
    };
  }

  if (event.type === "error") {
    if (machine.awaitingUrl || machine.refreshes >= SEEK_REFRESH_LIMIT) {
      return { machine, apply: null, refresh: false };
    }
    const target = machine.pending ?? machine.resumeAt;
    return {
      machine: { resumeAt: target, pending: target, refreshes: machine.refreshes + 1, awaitingUrl: true },
      apply: null,
      refresh: true,
    };
  }

  if (machine.pending == null) {
    if (!machine.awaitingUrl) return { machine, apply: null, refresh: false };
    return { machine: { ...machine, awaitingUrl: false }, apply: null, refresh: false };
  }
  return {
    machine: { ...machine, awaitingUrl: false },
    apply: machine.pending,
    refresh: false,
  };
}

export interface SeekableMedia {
  readyState: number;
  currentTime: number;
  play?: () => Promise<void> | void;
  addEventListener(type: "loadedmetadata", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "loadedmetadata", listener: () => void): void;
}

const waiting = new WeakMap<SeekableMedia, () => void>();

export function applyMediaSeek(video: SeekableMedia, seconds: number): void {
  const previous = waiting.get(video);
  if (previous) {
    video.removeEventListener("loadedmetadata", previous);
    waiting.delete(video);
  }

  let settled = false;
  const go = () => {
    if (settled) return;
    settled = true;
    if (waiting.get(video) === go) waiting.delete(video);
    video.currentTime = seconds;
    const pending = video.play?.();
    void Promise.resolve(pending).catch(() => undefined);
  };

  if (video.readyState >= 1) {
    go();
    return;
  }
  waiting.set(video, go);
  video.addEventListener("loadedmetadata", go, { once: true });
  if (video.readyState >= 1) go();
}
