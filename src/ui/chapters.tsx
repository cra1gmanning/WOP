import { useEffect, useRef, useState } from "react";
import type { ExerciseRow } from "../lib/exerciseCues";
import { formatClock } from "../lib/chapters";

export function ExerciseList({
  rows,
  activeIndex,
  onSeek,
  resetKey,
}: {
  rows: ExerciseRow[];
  activeIndex: number;
  onSeek: (seconds: number) => void;
  resetKey: string;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const timed = rows.some((row) => typeof row.t === "number");

  useEffect(() => {
    setDone({});
  }, [resetKey]);

  useEffect(() => {
    const list = listRef.current;
    const node = rowRefs.current[activeIndex];
    if (!list || !node || activeIndex < 0) return;
    if (list.scrollHeight <= list.clientHeight + 1) return;
    const delta = node.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (delta < 0) list.scrollTop += delta;
    else if (delta + node.offsetHeight > list.clientHeight) {
      list.scrollTop += delta + node.offsetHeight - list.clientHeight;
    }
  }, [activeIndex]);

  if (!rows.length) return null;

  return (
    <section className="chapter-list" aria-label="Exercises in this video">
      <div className="spread">
        <h2>Exercises</h2>
        <p className="muted">{rows.length}</p>
      </div>
      {timed ? <p className="muted chapter-hint">Tap an exercise to jump there. Tick to mark it done.</p> : null}
      <ol ref={listRef}>
        {rows.map((row) => {
          const current = row.index === activeIndex;
          const checked = Boolean(done[row.index]);
          const timedRow = typeof row.t === "number";
          return (
            <li
              key={`${row.index}-${row.name}`}
              ref={(node) => {
                rowRefs.current[row.index] = node;
              }}
              className={current ? "current" : checked ? "done" : undefined}
              aria-current={current ? "true" : undefined}
            >
              <button
                type="button"
                className={checked ? "check-hit on" : "check-hit"}
                aria-pressed={checked}
                aria-label={checked ? `Mark ${row.name} not done` : `Mark ${row.name} done`}
                onClick={() => setDone((currentDone) => ({ ...currentDone, [row.index]: !currentDone[row.index] }))}
              >
                {checked ? "✓" : ""}
              </button>
              {timedRow ? (
                <button
                  type="button"
                  className="chapter-jump"
                  aria-label={`Jump to ${row.name} at ${formatClock(row.t ?? 0)}`}
                  onClick={() => onSeek(row.t ?? 0)}
                >
                  <ExerciseCopy row={row} current={current} />
                </button>
              ) : (
                <div className="chapter-static">
                  <ExerciseCopy row={row} current={false} />
                </div>
              )}
              {timedRow ? <span className="chapter-time">{formatClock(row.t ?? 0)}</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export const ChapterList = ExerciseList;

function ExerciseCopy({ row, current }: { row: ExerciseRow; current: boolean }) {
  return (
    <span className="chapter-copy">
      <span className="chapter-title">
        {row.label ? <span className="dose-chip">{row.label}</span> : null}
        <strong>{row.name}</strong>
      </span>
      {row.dose ? <span className="chapter-dose">{row.dose}</span> : null}
      {row.cue ? <span className="chapter-cue" title={row.cue}>{row.cue}</span> : null}
      {current ? <span className="kicker">Now</span> : null}
    </span>
  );
}

export function CueRail({
  rows,
  duration,
  currentTime,
  activeIndex,
  onSeek,
}: {
  rows: ExerciseRow[];
  duration: number;
  currentTime: number;
  activeIndex: number;
  onSeek: (seconds: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [bubble, setBubble] = useState<{ index: number; token: number } | null>(null);
  const visible = rows.filter((row) => typeof row.t === "number" && row.t <= duration);

  useEffect(() => {
    const node = railRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), 2000);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  if (!visible.length || !Number.isFinite(duration) || duration <= 0) return null;

  const progress = Math.min(100, Math.max(0, (currentTime / duration) * 100));
  const activePos = visible.findIndex((row) => row.index === activeIndex);
  const next = activePos >= 0 ? visible[activePos + 1] : undefined;
  const active = activePos >= 0 ? visible[activePos] : undefined;

  return (
    <div className="cue-rail" ref={railRef}>
      <div className="cue-rail-track">
        {active && next && typeof active.t === "number" && typeof next.t === "number" ? (
          <span
            className="cue-rail-segment"
            style={{ left: `${(active.t / duration) * 100}%`, width: `${((next.t - active.t) / duration) * 100}%` }}
          />
        ) : null}
        <span className="cue-rail-fill" style={{ width: `${progress}%` }} />
      </div>
      {visible.map((row, index) => {
        const t = row.t ?? 0;
        const pct = (t / duration) * 100;
        const lit = t <= currentTime || row.index === activeIndex;
        const hit = hitBox(visible, index, duration, width);
        return (
          <button
            key={`${row.index}-${t}`}
            ref={(node) => {
              tickRefs.current[index] = node;
            }}
            type="button"
            className={lit ? "cue-tick lit" : "cue-tick"}
            style={{ left: hit.left, width: hit.width, transform: hit.transform }}
            aria-label={`Jump to ${row.name} at ${formatClock(t)}`}
            onClick={() => {
              onSeek(t);
              setBubble({ index: row.index, token: Date.now() });
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const nextIndex = event.key === "ArrowRight" ? index + 1 : index - 1;
              tickRefs.current[nextIndex]?.focus();
            }}
          >
            <span className="cue-tick-mark" style={hit.markLeft == null ? undefined : { left: hit.markLeft }} />
            <span
              className={bubble?.index === row.index ? "cue-bubble is-open" : "cue-bubble"}
              style={bubbleStyle(pct, width)}
            >
              {bubbleText(row)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function bubbleText(row: ExerciseRow): string {
  const head = [row.label, row.name].filter(Boolean).join(" ");
  return row.dose ? `${head} ${row.dose}` : head;
}

function bubbleStyle(pct: number, width: number): { maxWidth: string; transform: string } {
  const maxWidth = width > 0 ? `${Math.max(96, width * 0.7)}px` : "70%";
  if (pct < 18) return { maxWidth, transform: "translateX(0)" };
  if (pct > 82) return { maxWidth, transform: "translateX(-100%)" };
  return { maxWidth, transform: "translateX(-50%)" };
}

function hitBox(
  rows: ExerciseRow[],
  index: number,
  duration: number,
  width: number,
): { left: string; width: string; transform?: string; markLeft?: string } {
  const t = rows[index].t ?? 0;
  const pct = (t / duration) * 100;
  if (width < 28) return { left: `${pct}%`, width: "28px", transform: "translateX(-50%)" };
  const center = (t / duration) * width;
  const prev = index > 0 ? ((rows[index - 1].t ?? 0) / duration) * width : null;
  const next = index < rows.length - 1 ? ((rows[index + 1].t ?? 0) / duration) * width : null;
  const leftExtent = prev == null ? 14 : Math.min(14, (center - prev) / 2);
  const rightExtent = next == null ? 14 : Math.min(14, (next - center) / 2);
  return {
    left: `${center - leftExtent}px`,
    width: `${Math.max(leftExtent + rightExtent, 1)}px`,
    markLeft: `${leftExtent}px`,
  };
}
