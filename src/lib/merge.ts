import type { AppState, DayState, Favorite, LogEntry, SlotState, HabitCheck } from "../types";

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function newer<T extends { updatedAt: string }>(a: T, b: T): T {
  return a.updatedAt >= b.updatedAt ? a : b;
}

function mergeMap<T extends { updatedAt: string }>(left: Record<string, T>, right: Record<string, T>): Record<string, T> {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const out: Record<string, T> = {};
  for (const key of keys) {
    const a = left[key];
    const b = right[key];
    if (a && b) out[key] = newer(a, b);
    else out[key] = (a ?? b) as T;
  }
  return out;
}

function mergeById<T extends { id: string; updatedAt: string }>(left: T[], right: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of [...left, ...right]) {
    const prev = map.get(item.id);
    map.set(item.id, prev ? newer(prev, item) : item);
  }
  return [...map.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
}

function mergeChecks(
  left: Record<string, HabitCheck>,
  right: Record<string, HabitCheck>,
): Record<string, HabitCheck> {
  return mergeMap(left, right);
}

/** Last write wins per slot, day, log, favorite, and Habit check. Device identity is not part of the file. */
export function mergeState(local: AppState, remote: AppState): AppState {
  const habitsBase = newer(local.habits, remote.habits);
  const habitsOther = habitsBase === local.habits ? remote.habits : local.habits;
  return {
    version: 1,
    revision: Math.max(local.revision, remote.revision),
    updatedAt: local.updatedAt >= remote.updatedAt ? local.updatedAt : remote.updatedAt,
    meta: newer(local.meta, remote.meta),
    slots: mergeMap<SlotState>(local.slots, remote.slots),
    days: mergeMap<DayState>(local.days, remote.days),
    logs: mergeById<LogEntry>(local.logs, remote.logs).filter((entry) => !entry.deleted),
    favorites: mergeById<Favorite>(local.favorites, remote.favorites),
    habits: {
      ...habitsBase,
      unlockedThrough: Math.max(local.habits.unlockedThrough, remote.habits.unlockedThrough),
      checks: mergeChecks(habitsBase.checks, habitsOther.checks),
      updatedAt: habitsBase.updatedAt >= habitsOther.updatedAt ? habitsBase.updatedAt : habitsOther.updatedAt,
    },
  };
}

export function contentSignature(state: AppState): string {
  const { revision: _revision, updatedAt: _updatedAt, ...rest } = state;
  return stableStringify(rest);
}
