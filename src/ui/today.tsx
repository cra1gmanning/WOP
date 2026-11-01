import { useMemo, useState } from "react";
import { formatLong, todayString } from "../lib/dates";
import { planName } from "../lib/quiz";
import { advanceSlot, beginnerDay, collectVideos, cycleMedia, draftDay, replaceItem, resolveDay, trackExercises, withDayType } from "../lib/workout";
import type { DayState, DayType, ViewItem } from "../types";
import { uid } from "../state/default";
import { useApp } from "./context";
import { go } from "./router";
import { LogSheet, RestOverlay } from "./widgets";

export function TodayScreen({ date }: { date?: string }) {
  const app = useApp();
  const library = app.library;
  const today = todayString();
  const active = date || today;
  const [logItem, setLogItem] = useState<ViewItem | null>(null);
  const [rest, setRest] = useState<number | null>(null);
  const [caching, setCaching] = useState("");
  const [cacheNote, setCacheNote] = useState<string | null>(null);
  const [workoutPick, setWorkoutPick] = useState(1);

  const view = useMemo(
    () => (library ? resolveDay(library, app.state, active, today) : null),
    [library, app.state, active, today],
  );

  if (!library || !view) return <p className="muted">Loading the library…</p>;
  if (!app.state.meta.planId) return <Onboarding />;

  const planId = app.state.meta.planId;
  function snapshot(): DayState {
    return draftDay(library!, app.state, active, today, new Date().toISOString());
  }

  function shift(item: ViewItem, direction: 1 | -1) {
    if (!item.slotKey || !item.step || !item.stepCount) return;
    const next = Math.min(item.stepCount, Math.max(1, item.step + direction));
    app.dispatch({ type: "set-step", slotKey: item.slotKey, step: next });
  }

  function saveLog(item: ViewItem, result: { sets: number[]; mobilityDone: boolean; stayed: boolean; note: string }) {
    const now = new Date().toISOString();
    const exerciseId = item.exerciseId;
    let slotUpdate: { key: string; exerciseId: string; step: number; updatedAt: string } | undefined;
    let itemStep: { itemId: string; step: number } | undefined;
    let advanced = false;
    if (item.slotKey && exerciseId && item.step) {
      const track = trackExercises(library!, item.slotKey);
      const next = advanceSlot(track, { exerciseId, step: item.step }, result.stayed);
      advanced = next.exerciseId !== exerciseId || next.step !== item.step;
      slotUpdate = { key: item.slotKey, exerciseId: next.exerciseId, step: next.step, updatedAt: now };
    } else if (exerciseId && item.step && item.stepCount) {
      const nextStep = result.stayed || item.step >= item.stepCount ? item.step : item.step + 1;
      advanced = nextStep !== item.step;
      itemStep = { itemId: item.id, step: nextStep };
    }
    app.dispatch({
      type: "log",
      date: active,
      draft: snapshot(),
      entry: {
        id: uid(),
        date: active,
        itemId: item.id,
        exerciseId,
        slotKey: item.slotKey,
        title: item.title,
        block: item.subtitle,
        kind: "log",
        step: item.step,
        prescription: item.prescription,
        unit: item.steps?.[item.step! - 1]?.unit,
        target: item.steps?.[item.step! - 1]?.amount,
        sets: result.sets,
        perSide: item.steps?.[item.step! - 1]?.perSide,
        mobilityDone: result.mobilityDone,
        mobilityLabel: item.mobilityPrescription ? `${item.mobilityPrescription} ${item.mobilityName ?? ""}`.trim() : undefined,
        stayed: result.stayed,
        advanced,
        note: result.note || undefined,
        updatedAt: now,
      },
      slot: slotUpdate,
      itemStep,
      now,
    });
    setLogItem(null);
  }

  const loggedIds = new Set(
    app.state.logs.filter((entry) => entry.date === active && entry.kind === "log" && !entry.deleted).map((entry) => entry.itemId),
  );

  return (
    <section>
      <div className="spread">
        <div>
          <p className="kicker">{planName(planId)}</p>
          <h1>{active === today ? "Today" : formatLong(active)}</h1>
          <p className="muted">{formatLong(active)} · {view.headline}</p>
        </div>
        <button type="button" className="text" onClick={() => setRest(app.state.meta.restSec)}>Rest</button>
      </div>
      {app.libraryError ? <p className="banner error">{app.libraryError}</p> : null}
      <div className="row">
        <button type="button" onClick={() => go({ name: "day", date: add(active, -1) })}>Previous</button>
        {active !== today ? <button type="button" onClick={() => go({ name: "today" })}>Today</button> : null}
        <button type="button" onClick={() => go({ name: "day", date: add(active, 1) })}>Next</button>
      </div>

      {planId === "beginner" && view.items.length === 0 && active >= today ? (
        <div className="card">
          <h2>This day doesn't have a workout yet.</h2>
          <label className="stack">
            <span>Workout</span>
            <select value={workoutPick} onChange={(event) => setWorkoutPick(Number(event.target.value))}>
              {library.plans.beginner.workouts.map((workout) => (
                <option key={workout.n} value={workout.n}>Workout {workout.n}</option>
              ))}
            </select>
          </label>
          <button type="button" className="primary" onClick={() => app.dispatch({ type: "save-day", day: beginnerDay(library, active, workoutPick, new Date().toISOString()) })}>
            Generate workout
          </button>
        </div>
      ) : null}

      {view.items.length === 0 && (planId !== "beginner" || active < today) ? (
        <div className="card">
          <h2>{view.headline}</h2>
          {view.cleared && planId !== "beginner" && active >= today ? (
            <button type="button" onClick={() => app.dispatch({ type: "restore-day", date: active })}>Restore the template</button>
          ) : null}
        </div>
      ) : null}

      {planId !== "beginner" && active >= today ? (
        <label className="stack">
          <span>Day type</span>
          <select
            value={view.dayType ?? "upper"}
            onChange={(event) => {
              const dayType = event.target.value as DayType;
              app.dispatch({ type: "save-day", day: withDayType(library, app.state, active, dayType, new Date().toISOString()) });
            }}
          >
            {library.plans.dayTypes.map((dayType) => (
              <option key={dayType.id} value={dayType.id}>{dayType.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {view.items.map((item) => (
        <article key={item.id} className={item.done ? "card done" : "card"}>
          <div className="item-top">
            <button
              type="button"
              className={item.done ? "check-hit on" : "check-hit"}
              aria-label={item.done ? "Mark not done" : "Mark done"}
              onClick={() => app.dispatch({ type: "toggle-done", date: active, itemId: item.id, draft: snapshot() })}
            >
              {item.done ? "✓" : ""}
            </button>
            <div style={{ flex: 1 }}>
              <p className="kicker">{item.kind}</p>
              <h2>{item.title}</h2>
              {item.subtitle ? <p className="muted">{item.subtitle}</p> : null}
              {item.prescription ? <p className="prescription">{item.prescription}{item.mobilityName ? ` · mobility ${item.mobilityPrescription} ${item.mobilityName}` : ""}</p> : null}
              {item.step ? (
                <div className="stepper">
                  <button type="button" onClick={() => shift(item, -1)} aria-label="Previous step">‹</button>
                  <span>Step {item.step} of {item.stepCount}</span>
                  <button type="button" onClick={() => shift(item, 1)} aria-label="Next step">›</button>
                </div>
              ) : null}
              <div className="row">
                {item.exerciseId ? (
                  <button type="button" onClick={() => go({ name: "exercise", id: item.exerciseId!, day: active, item: item.id })}>Details</button>
                ) : item.path ? (
                  <button type="button" onClick={() => go({ name: "play", date: active })}>Play</button>
                ) : null}
                {item.kind === "strength" ? (
                  <button type="button" className={loggedIds.has(item.id) ? "good" : "primary"} onClick={() => setLogItem(item)}>
                    {loggedIds.has(item.id) ? "Logged" : "Log"}
                  </button>
                ) : null}
                {item.kind === "warmup" ? (
                  <button type="button" onClick={() => swap(item, "warmup")}>Swap</button>
                ) : null}
                {item.kind === "mobility" ? (
                  <button type="button" onClick={() => swap(item, "mobility")}>Swap</button>
                ) : null}
                {item.kind === "stretch" ? (
                  <button type="button" onClick={() => swap(item, "stretch")}>Swap</button>
                ) : null}
              </div>
            </div>
          </div>
        </article>
      ))}

      {view.items.length > 0 ? (
        <div className="row">
          <button type="button" className="primary" onClick={() => go({ name: "play", date: active })}>Play workout</button>
          <button type="button" onClick={() => markAll()}>Mark all as done</button>
          <button type="button" onClick={() => app.dispatch({ type: "clear-day", date: active, today })}>Clear day</button>
          <button type="button" disabled={Boolean(caching)} onClick={() => void cacheDay()}>
            {caching || "Save videos on this phone"}
          </button>
        </div>
      ) : null}
      {cacheNote ? <p className="banner">{cacheNote}</p> : null}
      {logItem ? <LogSheet item={logItem} onClose={() => setLogItem(null)} onSave={(result) => saveLog(logItem, result)} /> : null}
      {rest != null ? <RestOverlay seconds={rest} onClose={() => setRest(null)} /> : null}
    </section>
  );

  function swap(item: ViewItem, kind: "warmup" | "mobility" | "stretch") {
    const list = kind === "warmup"
      ? library!.media.warmups
      : kind === "mobility"
        ? library!.media.mobility
        : [library!.media.stretches.front, library!.media.stretches.middle, ...library!.media.stretches.extra];
    const next = cycleMedia(list, item.path, 1);
    if (!next) return;
    const day = replaceItem(snapshot(), item.id, { title: next.title, path: next.path }, new Date().toISOString());
    app.dispatch({ type: "save-day", day });
  }

  function markAll() {
    const now = new Date().toISOString();
    const entries = view!.items.filter((item) => !item.done).map((item) => ({
      id: uid(),
      date: active,
      itemId: item.id,
      title: item.title,
      kind: "check" as const,
      updatedAt: now,
    }));
    app.dispatch({ type: "mark-all", date: active, draft: snapshot(), entries, now });
  }

  async function cacheDay() {
    const videos = collectVideos(view!);
    if (videos.length === 0) return;
    setCacheNote(null);
    const failures = await app.cacheVideos(videos, (label) => setCaching(`Saving ${label}`));
    setCaching("");
    setCacheNote(failures.length ? failures.join(" ") : `Saved ${videos.length} video${videos.length === 1 ? "" : "s"} on this phone.`);
  }
}

function add(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function Onboarding() {
  const app = useApp();
  const library = app.library;
  if (!library) return null;
  return (
    <section>
      <p className="kicker">Start</p>
      <h1>Where do you want to train?</h1>
      <p>The quiz is a starting point. You can change the plan later.</p>
      <div className="row">
        <button type="button" className="primary" onClick={() => go({ name: "quiz" })}>Placement quiz</button>
        {library.plans.guided.map((plan) => (
          <button key={plan.id} type="button" onClick={() => app.dispatch({ type: "start-plan", planId: plan.id, reseed: true, library })}>
            {plan.name}
          </button>
        ))}
        <button type="button" onClick={() => app.dispatch({ type: "start-plan", planId: "beginner", reseed: false, library })}>Beginner</button>
      </div>
    </section>
  );
}
