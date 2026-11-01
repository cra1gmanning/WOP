import { useState } from "react";
import { formatLong, formatMonth, monthGrid, todayString } from "../lib/dates";
import { addDays } from "../lib/dates";
import { useApp } from "./context";

export function HistoryScreen() {
  const { state } = useApp();
  const [cursor, setCursor] = useState(todayString());
  const [selected, setSelected] = useState(todayString());
  const cells = monthGrid(cursor);
  const logged = new Set(state.logs.filter((entry) => !entry.deleted).map((entry) => entry.date));
  const dayLogs = state.logs.filter((entry) => entry.date === selected && !entry.deleted).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return (
    <section>
      <p className="kicker">History</p>
      <div className="spread">
        <h1>{formatMonth(cursor)}</h1>
        <div className="row">
          <button type="button" onClick={() => setCursor(addDays(cursor.slice(0, 7) + "-01", -1))}>‹</button>
          <button type="button" onClick={() => setCursor(addDays(cursor.slice(0, 7) + "-15", 20))}>›</button>
        </div>
      </div>
      <div className="cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <span key={label} className="muted">{label}</span>)}
        {cells.map((cell) => (
          <button
            key={cell.date}
            type="button"
            className={`${cell.date === selected ? "on" : ""} ${logged.has(cell.date) ? "has" : ""}`}
            style={{ opacity: cell.inMonth ? 1 : 0.4 }}
            onClick={() => setSelected(cell.date)}
          >
            {Number(cell.date.slice(-2))}
          </button>
        ))}
      </div>
      <h2>{formatLong(selected)}</h2>
      {dayLogs.length === 0 ? <p className="muted">No exercises logged for {formatLong(selected)}.</p> : null}
      {dayLogs.map((entry) => (
        <article key={entry.id} className="card">
          <h3>{entry.title}</h3>
          <p className="muted">{entry.kind === "log" ? "Logged" : "Completed"}{entry.prescription ? ` · target ${entry.prescription}` : ""}{entry.step ? ` · step ${entry.step}` : ""}</p>
          {entry.sets ? (
            <p>Sets: {entry.sets.map((value, index) => `Set ${index + 1}: ${value}${entry.unit === "s" ? "s" : entry.unit === "custom" ? (value ? " done" : " missed") : ""}`).join(" · ")}{entry.perSide ? " per side" : ""}</p>
          ) : null}
          {entry.mobilityLabel ? <p>Mobility {entry.mobilityDone ? "done" : "not done"} · {entry.mobilityLabel}</p> : null}
          {entry.stayed ? <p className="muted">Stayed on the same step.</p> : null}
          {entry.advanced ? <p className="muted">Step advanced.</p> : null}
          {entry.note ? <p>{entry.note}</p> : null}
        </article>
      ))}
    </section>
  );
}
