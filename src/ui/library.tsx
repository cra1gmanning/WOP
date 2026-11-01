import { useMemo, useState } from "react";
import { mobilityForStep } from "../lib/ladders";
import { advanceSlot, draftDay, exerciseById, trackExercises } from "../lib/workout";
import type { Exercise } from "../types";
import { uid } from "../state/default";
import { todayString } from "../lib/dates";
import { useApp } from "./context";
import { go } from "./router";
import { LogSheet, VideoPane } from "./widgets";

export function LibraryScreen() {
  const library = useApp().library;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"courses" | "classes">("courses");
  if (!library) return <p className="muted">Loading the library…</p>;
  const needle = query.trim().toLowerCase();
  const courses = library.courses.filter((course) => {
    if (!needle) return true;
    return course.name.toLowerCase().includes(needle)
      || course.category.toLowerCase().includes(needle)
      || course.tracks.some((track) => track.exerciseIds.some((id) => exerciseById(library, id)?.name.toLowerCase().includes(needle)));
  });
  const classes = library.classes.filter((item) => !needle || `${item.title} ${item.description}`.toLowerCase().includes(needle));
  const categories = [...new Set(courses.map((course) => course.category))];
  return (
    <section>
      <p className="kicker">Library</p>
      <h1>Videos</h1>
      <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
      <div className="tabs">
        <button type="button" className={tab === "courses" ? "good" : ""} onClick={() => setTab("courses")}>Courses</button>
        <button type="button" className={tab === "classes" ? "good" : ""} onClick={() => setTab("classes")}>Classes</button>
      </div>
      {tab === "courses" ? categories.map((category) => (
        <div key={category}>
          <h2>{category}</h2>
          {courses.filter((course) => course.category === category).map((course) => (
            <button key={course.id} type="button" className="card day-chip" onClick={() => go({ name: "course", id: course.id })}>
              <strong>{course.name}</strong>
              <div className="muted">{course.tracks.reduce((sum, track) => sum + track.exerciseIds.length + track.videos.length, 0)} items</div>
            </button>
          ))}
        </div>
      )) : classes.map((item) => (
        <button key={item.id} type="button" className="card day-chip" onClick={() => go({ name: "class", id: item.id })}>
          <strong>{item.title}</strong>
          <div className="muted">{item.difficulty} · {item.type}{item.minutes ? ` · ${item.minutes} min` : ""}</div>
        </button>
      ))}
    </section>
  );
}

export function CourseScreen({ id }: { id: string }) {
  const library = useApp().library;
  const course = library?.courses.find((item) => item.id === id);
  if (!library || !course) return <p>That course is not in the library.</p>;
  return (
    <section>
      <button type="button" className="text" onClick={() => go({ name: "library" })}>Library</button>
      <p className="kicker">{course.category}</p>
      <h1>{course.name}</h1>
      {course.tracks.map((track) => (
        <div key={track.name}>
          <h2>{track.name}</h2>
          {track.exerciseIds.map((exerciseId) => {
            const exercise = exerciseById(library, exerciseId);
            if (!exercise) return null;
            return (
              <button key={exerciseId} type="button" className="card day-chip" onClick={() => go({ name: "exercise", id: exerciseId })}>
                <strong>{exercise.level > 0 ? `L${exercise.level} · ` : ""}{exercise.name}</strong>
                <div className="muted">{exercise.strengthMastery}{exercise.mobilityName ? ` · ${exercise.mobilityName}` : ""}</div>
              </button>
            );
          })}
          {track.videos.map((video) => (
            <button key={video.path} type="button" className="card day-chip" onClick={() => go({ name: "exercise", id: `video:${video.path}` })}>
              <strong>{video.title}</strong>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}

export function ClassScreen({ id }: { id: string }) {
  const item = useApp().library?.classes.find((entry) => entry.id === id);
  if (!item) return <p>That class is not in the library.</p>;
  return (
    <section>
      <button type="button" className="text" onClick={() => go({ name: "library" })}>Library</button>
      <p className="kicker">{item.difficulty} · {item.type}</p>
      <h1>{item.title}</h1>
      {item.description ? <p>{item.description}</p> : null}
      {item.parts.map((part) => <VideoPane key={part.path} path={part.path} title={part.title} />)}
    </section>
  );
}

export function ExerciseScreen({ id, day, item }: { id: string; day?: string; item?: string }) {
  const app = useApp();
  const library = app.library;
  const [editing, setEditing] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const video = id.startsWith("video:") ? id.slice("video:".length) : "";
  const exercise = library?.exercises.find((entry) => entry.id === id);
  const slot = exercise?.slotKey ? app.state.slots[exercise.slotKey] : undefined;
  const active = day || todayString();
  const step = exercise && slot?.exerciseId === exercise.id ? slot.step : undefined;
  const prescription = exercise && step ? exercise.steps[step - 1] : exercise?.steps[0];
  const mobility = exercise && prescription ? mobilityForStep(exercise.mobilityMastery, prescription) : undefined;
  const viewItem = useMemo(() => {
    if (!exercise || !prescription) return null;
    return {
      id: item || `slot:${exercise.slotKey || exercise.id}`,
      kind: "strength" as const,
      title: exercise.name,
      subtitle: exercise.track,
      prescription: prescription.label,
      mobilityPrescription: mobility?.label,
      mobilityName: exercise.mobilityName,
      step: step || 1,
      stepCount: exercise.steps.length,
      done: false,
      exerciseId: exercise.id,
      slotKey: slot?.exerciseId === exercise.id ? exercise.slotKey : undefined,
      videos: [],
      steps: exercise.steps,
      focus: exercise.focus,
      mastery: exercise.strengthMastery,
      mobilityMastery: exercise.mobilityMastery,
    };
  }, [exercise, prescription, mobility, step, item, slot]);

  if (!library) return null;
  if (video) {
    const title = video.split("/").pop()?.replace(/\.mp4$/i, "") || "Video";
    return (
      <section>
        <button type="button" className="text" onClick={() => go({ name: "library" })}>Library</button>
        <h1>{title}</h1>
        <VideoPane path={video} title={title} />
      </section>
    );
  }
  if (!exercise || !viewItem) return <p>That exercise is not in the library.</p>;

  return (
    <section>
      <button type="button" className="text" onClick={() => history.back()}>Back</button>
      <p className="kicker">{exercise.course} · {exercise.track}</p>
      <h1>{exercise.name}</h1>
      <p className="prescription">{viewItem.prescription}{exercise.mobilityName ? ` · ${viewItem.mobilityPrescription} ${exercise.mobilityName}` : ""}</p>
      {viewItem.slotKey ? <p className="muted">Step {viewItem.step} of {viewItem.stepCount}</p> : <p className="muted">Mastery {exercise.strengthMastery}</p>}
      <div className="row">
        {viewItem.slotKey ? <button type="button" className="primary" onClick={() => setLogOpen(true)}>Log</button> : null}
        {exercise.slotKey ? <button type="button" onClick={() => setEditing(true)}>Change progression</button> : null}
        <button type="button" onClick={() => addToToday(exercise)}>Add to today</button>
      </div>
      <h2>Ladder</h2>
      <ol className="ladder">
        {exercise.steps.map((entry, index) => (
          <li key={entry.label}>
            <button
              type="button"
              className={index + 1 === viewItem.step && viewItem.slotKey ? "on" : ""}
              onClick={() => {
                if (viewItem.slotKey) app.dispatch({ type: "set-step", slotKey: viewItem.slotKey, step: index + 1 });
              }}
            >
              {index + 1}. {entry.label}
            </button>
          </li>
        ))}
      </ol>
      <h2>Mastery</h2>
      <p>Strength {exercise.strengthMastery || "—"}</p>
      <p>Mobility {exercise.mobilityMastery || "—"}{exercise.mobilityName ? ` · ${exercise.mobilityName}` : ""}</p>
      <h2>Focus</h2>
      <ul className="focus">
        {exercise.focus.strength.map((point) => <li key={point}>Strength: {point}</li>)}
        {exercise.focus.mobility.map((point) => <li key={point}>Mobility: {point}</li>)}
      </ul>
      {exercise.videos.strength ? <VideoPane path={exercise.videos.strength} title={`${exercise.name} strength`} /> : null}
      {exercise.videos.mobility.map((path) => <VideoPane key={path} path={path} title={exercise.mobilityName || "Mobility"} />)}
      {exercise.videos.tech.map((path, index) => <VideoPane key={path} path={path} title={`Technique ${index + 1}`} />)}
      {logOpen ? (
        <LogSheet
          item={viewItem}
          onClose={() => setLogOpen(false)}
          onSave={(result) => {
            if (!viewItem.slotKey || !viewItem.step) return;
            const track = trackExercises(library, viewItem.slotKey);
            const next = advanceSlot(track, { exerciseId: exercise.id, step: viewItem.step }, result.stayed);
            const now = new Date().toISOString();
            app.dispatch({
              type: "log",
              date: active,
              draft: draftDay(library, app.state, active, todayString(), now),
              entry: {
                id: uid(),
                date: active,
                itemId: viewItem.id,
                exerciseId: exercise.id,
                slotKey: viewItem.slotKey,
                title: exercise.name,
                kind: "log",
                step: viewItem.step,
                prescription: viewItem.prescription,
                sets: result.sets,
                mobilityDone: result.mobilityDone,
                stayed: result.stayed,
                advanced: next.step !== viewItem.step || next.exerciseId !== exercise.id,
                note: result.note || undefined,
                updatedAt: now,
              },
              slot: { key: viewItem.slotKey, exerciseId: next.exerciseId, step: next.step, updatedAt: now },
              now,
            });
            setLogOpen(false);
          }}
        />
      ) : null}
      {editing && exercise.slotKey ? (
        <ProgressionPicker
          slotKey={exercise.slotKey}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </section>
  );

  function addToToday(chosen: Exercise) {
    const now = new Date().toISOString();
    const date = todayString();
    const base = draftDay(library!, app.state, date, date, now);
    const items = [...base.items, {
      id: uid(),
      kind: "strength" as const,
      exerciseId: chosen.id,
      step: 1,
      title: chosen.name,
      done: false,
    }];
    app.dispatch({ type: "save-day", day: { ...base, source: base.source === "rest" ? "byo" : base.source, items, updatedAt: now } });
    go({ name: "today" });
  }
}

function ProgressionPicker({ slotKey, onClose }: { slotKey: string; onClose: () => void }) {
  const app = useApp();
  const library = app.library!;
  const exercises = trackExercises(library, slotKey);
  const levels = [...new Set(exercises.map((exercise) => exercise.level))];
  const [level, setLevel] = useState(levels[0] ?? 1);
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [step, setStep] = useState(1);
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h2>Edit progression</h2>
          <button type="button" className="text" onClick={onClose}>Close</button>
        </div>
        <div className="levels">
          {levels.map((value) => (
            <button key={value} type="button" className={value === level ? "on" : ""} onClick={() => setLevel(value)}>Level {value}</button>
          ))}
        </div>
        {exercises.filter((exercise) => exercise.level === level).map((exercise) => (
          <button key={exercise.id} type="button" className={picked?.id === exercise.id ? "good" : ""} onClick={() => { setPicked(exercise); setStep(1); }}>
            {exercise.name}
          </button>
        ))}
        {picked ? (
          <>
            <label className="stack">
              Step
              <select value={step} onChange={(event) => setStep(Number(event.target.value))}>
                {picked.steps.map((entry, index) => <option key={entry.label} value={index + 1}>{index + 1}. {entry.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="primary"
              onClick={() => {
                app.dispatch({ type: "set-progression", slotKey, exerciseId: picked.id, step });
                onClose();
              }}
            >
              Use this progression
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
