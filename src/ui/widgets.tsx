import { useEffect, useRef, useState } from "react";
import { activeChapterIndex } from "../lib/chapters";
import { setChoices } from "../lib/ladders";
import { applyMediaSeek, initialSeekMachine, reduceSeek, type SeekMachine } from "../lib/mediaSeek";
import type { Prescription, ViewItem } from "../types";
import { ChapterList } from "./chapters";
import { useApp, type VideoSource } from "./context";

export function VideoPane({ path, title }: { path: string; title: string }) {
  const { videoSource, chaptersFor } = useApp();
  const cues = chaptersFor(path);
  const [source, setSource] = useState<VideoSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<SeekMachine>(initialSeekMachine());
  const revokeRef = useRef<(() => void) | undefined>(undefined);
  const generation = useRef(0);
  const sourceGen = useRef(-1);

  const sourceFn = useRef(videoSource);
  sourceFn.current = videoSource;

  function retain(next: VideoSource) {
    if (revokeRef.current && revokeRef.current !== next.revoke) revokeRef.current();
    revokeRef.current = next.revoke;
    sourceGen.current = generation.current;
    setSource(next);
  }

  useEffect(() => {
    const gen = generation.current;
    seekRef.current = initialSeekMachine();
    sourceGen.current = -1;
    setPlayhead(0);
    setCollapsed(false);
    setBusy(true);
    setError(null);
    setSource(null);
    sourceFn.current(path)
      .then((next) => {
        if (generation.current !== gen) {
          next.revoke?.();
          return;
        }
        retain(next);
        setBusy(false);
      })
      .catch((reason: unknown) => {
        if (generation.current !== gen) return;
        setBusy(false);
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      generation.current += 1;
      revokeRef.current?.();
      revokeRef.current = undefined;
    };
  }, [path]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const machine = seekRef.current;
    if (!machine.awaitingUrl && machine.pending == null) return;
    const decision = reduceSeek(machine, { type: "url-mounted" });
    seekRef.current = decision.machine;
    if (decision.apply != null) applyMediaSeek(video, decision.apply);
  }, [source]);

  async function refreshUrl() {
    const gen = generation.current;
    try {
      const next = await sourceFn.current(path, true);
      if (generation.current !== gen) {
        next.revoke?.();
        return;
      }
      retain(next);
      setError(null);
    } catch (reason: unknown) {
      if (generation.current !== gen) return;
      seekRef.current = { ...seekRef.current, awaitingUrl: false };
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function onMediaError() {
    if (sourceGen.current !== generation.current) return;
    const decision = reduceSeek(seekRef.current, { type: "error" });
    seekRef.current = decision.machine;
    if (decision.refresh) void refreshUrl();
  }

  function onSeek(seconds: number) {
    setCollapsed(false);
    setPlayhead(seconds);
    const decision = reduceSeek(seekRef.current, { type: "tap", seconds });
    seekRef.current = decision.machine;
    const video = videoRef.current;
    if (video && decision.apply != null) applyMediaSeek(video, decision.apply);
  }

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const decision = reduceSeek(seekRef.current, { type: "time", seconds: video.currentTime });
    seekRef.current = decision.machine;
    const next = video.currentTime;
    setPlayhead((current) => (activeChapterIndex(cues, current) === activeChapterIndex(cues, next) ? current : next));
  }

  function onSeeked() {
    const video = videoRef.current;
    if (!video) return;
    const decision = reduceSeek(seekRef.current, { type: "seeked", seconds: video.currentTime });
    seekRef.current = decision.machine;
    setPlayhead(video.currentTime);
  }

  const hasChapters = cues.length > 0;
  const active = activeChapterIndex(cues, playhead);

  return (
    <figure className={hasChapters ? `video-pane has-chapters${collapsed ? " video-collapsed" : ""}` : "video-pane"}>
      <figcaption>
        {hasChapters ? (
          <>
            <span>{title}</span>
            <button
              type="button"
              className="text"
              aria-expanded={!collapsed}
              onClick={() => {
                setCollapsed((value) => {
                  if (!value) videoRef.current?.pause();
                  return !value;
                });
              }}
            >
              {collapsed ? "Show video" : "Hide video"}
            </button>
          </>
        ) : (
          title
        )}
      </figcaption>
      <div className="video-slot" hidden={collapsed}>
        {source ? (
          <video
            ref={videoRef}
            key={source.src}
            src={source.src}
            controls
            playsInline
            preload="metadata"
            onError={onMediaError}
            onTimeUpdate={onTimeUpdate}
            onSeeked={onSeeked}
          />
        ) : (
          <p className="muted video-fallback">{busy ? "Opening video…" : error}</p>
        )}
        {source && error ? <p className="banner error">{error}</p> : null}
      </div>
      {hasChapters ? <ChapterList cues={cues} activeIndex={active} onSeek={onSeek} /> : null}
      <p className="path">{path}</p>
    </figure>
  );
}

export function LogSheet({
  item,
  onClose,
  onSave,
}: {
  item: ViewItem;
  onClose: () => void;
  onSave: (result: { sets: number[]; mobilityDone: boolean; stayed: boolean; note: string }) => void;
}) {
  const step = item.steps?.[((item.step ?? 1) - 1)] ;
  const unit = step?.unit ?? "r";
  const target = step?.amount ?? 0;
  const setCount = Math.max(step?.sets ?? 1, 1);
  const choices = setChoices(unit === "custom" ? 1 : target, unit);
  const [sets, setSets] = useState<number[]>(() => Array.from({ length: setCount }, () => (unit === "custom" ? 1 : target)));
  const [mobilityDone, setMobilityDone] = useState(true);
  const [stayed, setStayed] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <form
        className="sheet"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ sets, mobilityDone, stayed, note: note.trim() });
        }}
      >
        <header className="sheet-head">
          <h2>Log {item.title}</h2>
          <button type="button" className="text" onClick={onClose}>Cancel</button>
        </header>
        <p className="prescription">{item.prescription}</p>
        {item.mobilityName ? (
          <label className="check">
            <input type="checkbox" checked={mobilityDone} onChange={(event) => setMobilityDone(event.target.checked)} />
            <span>I completed all mobility{item.mobilityPrescription ? `: ${item.mobilityPrescription}` : ""}{item.mobilityName ? ` ${item.mobilityName}` : ""}</span>
          </label>
        ) : null}
        <fieldset>
          <legend>Strength {unit === "s" ? "(seconds)" : unit === "custom" ? "" : "(reps)"}</legend>
          {sets.map((value, index) => (
            <label key={index} className="set-row">
              <span>Set {index + 1}{step?.perSide ? " / side" : ""}</span>
              <select
                value={value}
                onChange={(event) => {
                  const next = [...sets];
                  next[index] = Number(event.target.value);
                  setSets(next);
                }}
              >
                {choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {unit === "custom" ? (choice ? "Done" : "Missed") : choice}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={stayed} onChange={(event) => setStayed(event.target.checked)} />
          <span>I want to stay on the same step</span>
        </label>
        <label className="stack">
          <span>Note</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
        </label>
        <button type="submit" className="primary">Save</button>
      </form>
    </div>
  );
}

export function RestOverlay({
  seconds,
  onClose,
}: {
  seconds: number;
  onClose: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(Date.now() + seconds * 1000);

  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    void navigator.wakeLock?.request("screen").then((sentinel) => {
      lock = sentinel;
    }).catch(() => undefined);
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
      setLeft(next);
      if (next === 0) {
        window.clearInterval(timer);
        beep();
      }
    }, 200);
    return () => {
      window.clearInterval(timer);
      void lock?.release();
    };
  }, []);

  const minutes = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, "0");
  return (
    <div className="timer-overlay">
      <p>Rest</p>
      <strong>{minutes}:{secs}</strong>
      <div className="row">
        <button type="button" onClick={() => { end.current += 15000; }}>+15s</button>
        <button type="button" className="primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function beep() {
  const audio = new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.25);
  osc.onended = () => void audio.close();
}

export function choiceLabel(prescription: Prescription | undefined, value: number): string {
  if (!prescription || prescription.unit === "custom") return value ? "Done" : "Missed";
  return `${value}${prescription.unit === "s" ? "s" : ""}`;
}
