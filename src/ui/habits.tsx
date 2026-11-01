import { useState } from "react";
import { dowOf, todayString } from "../lib/dates";
import { habitStreak, taskKey } from "../lib/workout";
import { useApp } from "./context";
import { go } from "./router";
import { VideoPane } from "./widgets";

export function HabitScreen() {
  const app = useApp();
  const habits = app.library?.habits;
  const today = todayString();
  const sunday = dowOf(today) === 0;
  const streak = habitStreak(app.state, today);
  const [height, setHeight] = useState(app.state.habits.height);
  const [weight, setWeight] = useState(app.state.habits.weight);
  if (!habits) return <p className="muted">Loading habits…</p>;
  const unlocked = app.state.habits.unlockedThrough;
  return (
    <section>
      <p className="kicker">Habits</p>
      <h1>Habits</h1>
      <p>Train the habits six days a week. Sunday is off. Six adherent days in a row earns the next habit. Portion notes in the lessons use men / women.</p>
      <p className="prescription">Streak {streak} · habit {unlocked} of {habits.tasks.length}</p>
      {streak >= 6 && unlocked < habits.tasks.length ? (
        <button type="button" className="primary" onClick={() => app.dispatch({ type: "habit-unlock", unlockedThrough: unlocked + 1 })}>
          Unlock habit {unlocked + 1}
        </button>
      ) : null}
      {sunday ? <p className="banner">Sunday is the day off. The streak does not break.</p> : null}
      {habits.tasks.map((task) => {
        const open = task.n <= unlocked;
        const key = taskKey(today, task.n);
        const checked = Boolean(app.state.habits.checks[key]?.done);
        return (
          <article key={task.id} className="card">
            <label className="check">
              <input
                type="checkbox"
                disabled={!open || sunday}
                checked={checked}
                onChange={(event) => app.dispatch({ type: "habit-check", key, done: event.target.checked })}
              />
              <span><strong>{task.n}. {task.label}</strong>{open ? "" : " · locked"}</span>
            </label>
            <div className="row">
              <button type="button" onClick={() => go({ name: "lesson", id: task.lessonId })}>Lesson</button>
              {task.noteId ? <button type="button" onClick={() => go({ name: "lesson", id: task.noteId! })}>Notes</button> : null}
            </div>
          </article>
        );
      })}
      <h2>Profile</h2>
      <label className="stack">Height<input value={height} onChange={(event) => setHeight(event.target.value)} /></label>
      <label className="stack">Weight<input value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
      <div className="row">
        <button type="button" onClick={() => app.dispatch({ type: "habit-profile", height, weight })}>Save profile</button>
        <label className="stack">
          Before photo
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void app.uploadPhoto(file);
            }}
          />
        </label>
      </div>
    </section>
  );
}

export function LessonScreen({ id }: { id: string }) {
  const lesson = useApp().library?.habits.lessons.find((item) => item.id === id);
  if (!lesson) return <p>That lesson is not in the library.</p>;
  return (
    <section>
      <button type="button" className="text" onClick={() => go({ name: "habits" })}>Habit</button>
      <p className="kicker">Task {lesson.task}</p>
      <h1>{lesson.title}</h1>
      {lesson.path ? <VideoPane path={lesson.path} title={lesson.title} /> : <p className="muted">No video for this lesson. The notes are below.</p>}
      {lesson.body.split(/\n\n+/).map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}
    </section>
  );
}
