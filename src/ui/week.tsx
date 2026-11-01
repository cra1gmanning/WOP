import { useState } from "react";
import { addDays, formatLong, mondayOf, todayString, weekDates } from "../lib/dates";
import { resolveDay } from "../lib/workout";
import { useApp } from "./context";
import { go } from "./router";

export function WeekScreen() {
  const app = useApp();
  const library = app.library;
  const today = todayString();
  const [anchor, setAnchor] = useState(today);
  if (!library) return <p className="muted">Loading the library…</p>;
  const days = weekDates(anchor);
  return (
    <section>
      <p className="kicker">Week</p>
      <h1>{formatLong(days[0])} – {formatLong(days[6])}</h1>
      <div className="row">
        <button type="button" onClick={() => setAnchor(addDays(mondayOf(anchor), -7))}>Previous week</button>
        <button type="button" onClick={() => setAnchor(today)}>This week</button>
        <button type="button" onClick={() => setAnchor(addDays(mondayOf(anchor), 7))}>Next week</button>
      </div>
      <div className="week-grid">
        {days.map((date) => {
          const view = resolveDay(library, app.state, date, today);
          return (
            <button key={date} type="button" className="card day-chip" onClick={() => go({ name: "day", date })}>
              <strong>{formatLong(date)}{date === today ? " · today" : ""}</strong>
              <div className="muted">{view.headline}</div>
              {view.items.slice(0, 6).map((item) => (
                <div key={item.id}>{item.done ? "✓ " : ""}{item.title}{item.prescription ? ` · ${item.prescription}` : ""}</div>
              ))}
            </button>
          );
        })}
      </div>
    </section>
  );
}
