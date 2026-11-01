import { useEffect, useRef, useState } from "react";
import { setChoices } from "../lib/ladders";
import type { Prescription, ViewItem } from "../types";
import { useApp, type VideoSource } from "./context";

export function VideoPane({ path, title }: { path: string; title: string }) {
  const { videoSource } = useApp();
  const [source, setSource] = useState<VideoSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tried = useRef(false);

  const sourceFn = useRef(videoSource);
  sourceFn.current = videoSource;

  useEffect(() => {
    let dead = false;
    let revoke: (() => void) | undefined;
    setBusy(true);
    setError(null);
    tried.current = false;
    sourceFn.current(path)
      .then((next) => {
        if (dead) {
          next.revoke?.();
          return;
        }
        revoke = next.revoke;
        setSource(next);
        setBusy(false);
      })
      .catch((reason: unknown) => {
        if (!dead) {
          setBusy(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      dead = true;
      revoke?.();
    };
  }, [path]);

  async function refresh() {
    if (tried.current) return;
    tried.current = true;
    const currentTime = videoRef.current?.currentTime ?? 0;
    try {
      const next = await videoSource(path, true);
      setSource(next);
      setError(null);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.currentTime = currentTime;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <figure className="video-pane">
      <figcaption>{title}</figcaption>
      {source ? (
        <video
          ref={videoRef}
          key={source.src}
          src={source.src}
          controls
          playsInline
          preload="metadata"
          onError={() => void refresh()}
        />
      ) : (
        <p className="muted">{busy ? "Opening video…" : error}</p>
      )}
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
