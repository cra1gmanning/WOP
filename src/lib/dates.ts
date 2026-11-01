export function todayString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return todayString(date);
}

/** 0 Sunday … 6 Saturday, in the local calendar. */
export function dowOf(iso: string): number {
  return parseDate(iso).getDay();
}

export function mondayOf(iso: string): string {
  const dow = dowOf(iso);
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, delta);
}

export function weekDates(iso: string): string[] {
  const monday = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatLong(iso: string): string {
  return parseDate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatMonth(iso: string): string {
  return parseDate(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function monthGrid(iso: string): { date: string; inMonth: boolean }[] {
  const current = parseDate(iso);
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const startDow = first.getDay();
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const start = new Date(first);
  start.setDate(first.getDate() + mondayOffset);
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      date: todayString(date),
      inMonth: date.getMonth() === current.getMonth(),
    });
  }
  return cells;
}
