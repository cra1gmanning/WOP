import { useEffect, useRef, useState } from "react";
import { formatClock, type ChapterCue } from "../lib/chapters";

export function ChapterList({
  cues,
  activeIndex,
  onSeek,
}: {
  cues: ChapterCue[];
  activeIndex: number;
  onSeek: (seconds: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const cueKey = cues.map((cue) => `${cue.t}\t${cue.name}`).join("\n");

  useEffect(() => {
    setDone({});
  }, [cueKey]);

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

  if (!cues.length) return null;

  return (
    <section className="chapter-list" aria-label="Exercises in this video">
      <div className="spread">
        <h2>Exercises</h2>
        <p className="muted">{cues.length}</p>
      </div>
      <p className="muted chapter-hint">Mark exercises as you go. Marks stay on this screen. Tap a name to jump the video there.</p>
      <ol ref={listRef}>
        {cues.map((cue, index) => {
          const current = index === activeIndex;
          const checked = Boolean(done[index]);
          return (
            <li
              key={`${cue.t}-${index}`}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              className={current ? "current" : checked ? "done" : undefined}
              aria-current={current ? "true" : undefined}
            >
              <button
                type="button"
                className={checked ? "check-hit on" : "check-hit"}
                aria-pressed={checked}
                aria-label={checked ? `Mark ${cue.name} not done` : `Mark ${cue.name} done`}
                onClick={() => setDone((currentDone) => ({ ...currentDone, [index]: !currentDone[index] }))}
              >
                {checked ? "✓" : ""}
              </button>
              <button type="button" className="chapter-jump" onClick={() => onSeek(cue.t)}>
                <span className="chapter-time">{formatClock(cue.t)}</span>
                <span className="chapter-copy">
                  <strong>{cue.name}</strong>
                  {cue.note ? <span className="chapter-note">{cue.note}</span> : null}
                  {current ? <span className="kicker">Now</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
