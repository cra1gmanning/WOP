import { useState, type ReactNode } from "react";
import { todayString } from "../lib/dates";
import { cloneItems, exerciseById, previousWorkoutDate, sameWeekdayLastWeek } from "../lib/workout";
import type { ByoGroup, DayItem } from "../types";
import { uid } from "../state/default";
import { useApp } from "./context";
import { go } from "./router";

const GROUPS: { id: ByoGroup; label: string }[] = [
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "core", label: "Core" },
  { id: "legs", label: "Legs" },
];

export function BuildScreen() {
  const app = useApp();
  const library = app.library;
  const today = todayString();
  const [date, setDate] = useState(today);
  const [picker, setPicker] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [favName, setFavName] = useState("");
  if (!library) return <p className="muted">Loading the library…</p>;
  const stored = app.state.days[date];
  const items = stored?.items ?? [];

  function save(next: DayItem[], source: "byo" | "guided" | "beginner" = "byo") {
    const now = new Date().toISOString();
    app.dispatch({
      type: "save-day",
      day: { date, source, items: next, updatedAt: now, dayType: stored?.dayType },
    });
  }

  return (
    <section>
      <p className="kicker">Build your own</p>
      <h1>Workout</h1>
      <label className="stack">
        Day
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      {items.length === 0 ? <p>This day doesn't have a workout yet.</p> : null}
      {items.map((item) => (
        <article key={item.id} className="card spread">
          <div>
            <strong>{item.title || exerciseById(library, item.exerciseId)?.name || item.kind}</strong>
            {item.step ? <div className="muted">Step {item.step}</div> : null}
          </div>
          <button type="button" onClick={() => save(items.filter((entry) => entry.id !== item.id))}>Remove</button>
        </article>
      ))}
      <div className="row">
        <button type="button" onClick={() => setPicker("warmup")}>Warm-up</button>
        <button type="button" onClick={() => setPicker("follow")}>Follow along</button>
        {GROUPS.map((group) => <button key={group.id} type="button" onClick={() => setPicker(group.id)}>{group.label}</button>)}
        <button type="button" onClick={() => setPicker("mobility")}>Mobility</button>
        <button type="button" onClick={() => setPicker("skill")}>Skill</button>
      </div>
      <div className="row">
        <button type="button" onClick={() => copyFrom(previousWorkoutDate(app.state, date))}>Copy last workout</button>
        <button type="button" onClick={() => {
          const prior = sameWeekdayLastWeek(app.state, date);
          if (prior) save(cloneItems(prior.items));
        }}>Copy last week</button>
      </div>
      <label className="stack">
        Favorite name
        <input value={favName} onChange={(event) => setFavName(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={!favName.trim() || items.length === 0}
        onClick={() => app.dispatch({ type: "save-favorite", favorite: { id: uid(), name: favName.trim(), items: cloneItems(items), updatedAt: new Date().toISOString() } })}
      >
        Save favorite
      </button>
      {app.state.favorites.map((favorite) => (
        <article key={favorite.id} className="card spread">
          <strong>{favorite.name}</strong>
          <div className="row">
            <button type="button" onClick={() => save(cloneItems(favorite.items))}>Load</button>
            <button type="button" onClick={() => app.dispatch({ type: "delete-favorite", id: favorite.id })}>Delete</button>
          </div>
        </article>
      ))}
      <button type="button" className="primary" onClick={() => go({ name: "day", date })}>Open this day</button>
      {picker ? (
        <Picker
          mode={picker}
          level={level}
          setLevel={setLevel}
          onClose={() => setPicker(null)}
          onAdd={(item) => {
            save([...items, item]);
            setPicker(null);
          }}
        />
      ) : null}
    </section>
  );

  function copyFrom(from: string | undefined) {
    if (!from) return;
    const day = app.state.days[from];
    if (!day) return;
    save(cloneItems(day.items));
  }
}

function Picker({
  mode,
  level,
  setLevel,
  onClose,
  onAdd,
}: {
  mode: string;
  level: number;
  setLevel: (level: number) => void;
  onClose: () => void;
  onAdd: (item: DayItem) => void;
}) {
  const library = useApp().library!;
  let body: ReactNode = null;
  if (mode === "warmup") {
    body = library.media.warmups.map((item) => (
      <button key={item.path} type="button" onClick={() => onAdd({ id: uid(), kind: "warmup", title: item.title, path: item.path, done: false })}>{item.title}</button>
    ));
  } else if (mode === "follow") {
    body = library.classes.flatMap((item) => item.parts.map((part) => (
      <button key={part.path} type="button" onClick={() => onAdd({ id: uid(), kind: "followalong", title: item.parts.length > 1 ? part.title : item.title, path: part.path, done: false })}>
        {item.parts.length > 1 ? `${item.title}: ${part.title}` : item.title}
      </button>
    )));
  } else if (mode === "skill") {
    const courses = library.courses;
    body = courses.flatMap((course) => course.tracks.flatMap((track) => [
      ...track.exerciseIds.flatMap((id) => {
        const exercise = exerciseById(library, id);
        const path = exercise?.videos.strength;
        if (!exercise || !path) return [];
        return [(
          <button key={path} type="button" onClick={() => onAdd({ id: uid(), kind: "skill", title: exercise.name, path, exerciseId: exercise.id, done: false })}>
            {course.name}: {exercise.name}
          </button>
        )];
      }),
      ...track.videos.map((video) => (
        <button key={video.path} type="button" onClick={() => onAdd({ id: uid(), kind: "skill", title: video.title, path: video.path, done: false })}>
          {course.name}: {video.title}
        </button>
      )),
    ]));
  } else if (mode === "mobility") {
    const drills = library.exercises.filter((exercise) => exercise.byoGroup && exercise.mobilityName && exercise.videos.mobility[0] && exercise.level === level);
    body = (
      <>
        <LevelBar level={level} setLevel={setLevel} />
        {drills.map((exercise) => (
          <button key={`${exercise.id}-m`} type="button" onClick={() => onAdd({ id: uid(), kind: "mobility", title: exercise.mobilityName, path: exercise.videos.mobility[0], done: false })}>
            {exercise.mobilityName}
          </button>
        ))}
      </>
    );
  } else {
    const group = mode as ByoGroup;
    const exercises = library.exercises.filter((exercise) => exercise.byoGroup === group && exercise.level === level);
    body = (
      <>
        <LevelBar level={level} setLevel={setLevel} />
        {exercises.map((exercise) => (
          <button key={exercise.id} type="button" onClick={() => onAdd({ id: uid(), kind: "strength", title: exercise.name, exerciseId: exercise.id, step: 1, done: false })}>
            {exercise.name}
          </button>
        ))}
      </>
    );
  }
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h2>Add</h2>
          <button type="button" className="text" onClick={onClose}>Close</button>
        </div>
        <div className="stack">{body}</div>
      </div>
    </div>
  );
}

function LevelBar({ level, setLevel }: { level: number; setLevel: (level: number) => void }) {
  return (
    <div className="levels">
      {[1, 2, 3, 4].map((value) => (
        <button key={value} type="button" className={value === level ? "on" : ""} onClick={() => setLevel(value)}>Level {value}</button>
      ))}
    </div>
  );
}
