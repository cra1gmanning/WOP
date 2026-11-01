import type { AppState, DayState, Favorite, LogEntry, SlotState } from "../types";
import type { Library, PlanId } from "../types";
import { normalizeLibraryRoot } from "../lib/paths";
import { seedSlots } from "../lib/workout";

export type Action =
  | { type: "replace"; state: AppState }
  | { type: "start-plan"; planId: PlanId; reseed: boolean; library: Library; now?: string }
  | { type: "save-quiz"; answers: number[]; level: PlanId; now?: string }
  | { type: "save-day"; day: DayState }
  | { type: "toggle-done"; date: string; itemId: string; draft: DayState; now?: string }
  | { type: "mark-all"; date: string; draft: DayState; entries: LogEntry[]; now?: string }
  | { type: "clear-day"; date: string; today: string; now?: string }
  | { type: "restore-day"; date: string; now?: string }
  | { type: "set-step"; slotKey: string; step: number; now?: string }
  | { type: "set-item-step"; date: string; draft: DayState; itemId: string; step: number; now?: string }
  | { type: "set-progression"; slotKey: string; exerciseId: string; step: number; now?: string }
  | {
      type: "log";
      date: string;
      draft: DayState;
      entry: LogEntry;
      slot?: { key: string } & SlotState;
      itemStep?: { itemId: string; step: number };
      now?: string;
    }
  | { type: "save-favorite"; favorite: Favorite }
  | { type: "delete-favorite"; id: string; now?: string }
  | { type: "habit-check"; key: string; done: boolean; now?: string }
  | { type: "habit-profile"; height?: string; weight?: string; photoPath?: string; now?: string }
  | { type: "habit-unlock"; unlockedThrough: number; now?: string }
  | { type: "set-rest"; sec: number; now?: string }
  | { type: "set-library-root"; libraryRoot: string; now?: string }
  | { type: "reset-slots"; library: Library; now?: string };

function stamp(action: Action): string {
  if ("now" in action && typeof action.now === "string") return action.now;
  return new Date().toISOString();
}

function touch(state: AppState, now: string, meta = state.meta): AppState {
  return { ...state, updatedAt: now, meta };
}

export function reducer(state: AppState, action: Action): AppState {
  if (action.type === "replace") return action.state;
  const now = stamp(action);

  switch (action.type) {
    case "save-quiz":
      return touch(state, now, {
        ...state.meta,
        quiz: { answers: action.answers, level: action.level, takenAt: now },
        updatedAt: now,
      });
    case "start-plan": {
      const reseed = action.reseed || Object.keys(state.slots).length === 0;
      const slots = reseed && action.planId !== "beginner" ? seedSlots(action.library, action.planId, now) : state.slots;
      return {
        ...state,
        updatedAt: now,
        slots,
        meta: { ...state.meta, planId: action.planId, updatedAt: now },
      };
    }
    case "save-day":
      return {
        ...state,
        updatedAt: now,
        days: { ...state.days, [action.day.date]: { ...action.day, updatedAt: action.day.updatedAt || now } },
      };
    case "toggle-done": {
      const base = state.days[action.date] ?? action.draft;
      const items = base.items.map((item) => (item.id === action.itemId ? { ...item, done: !item.done } : item));
      const day: DayState = { ...base, date: action.date, items, updatedAt: now };
      return { ...state, updatedAt: now, days: { ...state.days, [action.date]: day } };
    }
    case "mark-all": {
      const base = state.days[action.date] ?? action.draft;
      const day: DayState = {
        ...base,
        date: action.date,
        updatedAt: now,
        items: base.items.map((item) => ({ ...item, done: true })),
      };
      return {
        ...state,
        updatedAt: now,
        days: { ...state.days, [action.date]: day },
        logs: [...state.logs, ...action.entries],
      };
    }
    case "clear-day": {
      const day: DayState = { date: action.date, source: "rest", items: [], cleared: true, updatedAt: now };
      return { ...state, updatedAt: now, days: { ...state.days, [action.date]: day } };
    }
    case "restore-day": {
      const days = { ...state.days };
      delete days[action.date];
      return { ...state, updatedAt: now, days };
    }
    case "set-step": {
      const slot = state.slots[action.slotKey];
      if (!slot) return state;
      return {
        ...state,
        updatedAt: now,
        slots: {
          ...state.slots,
          [action.slotKey]: { ...slot, step: action.step, updatedAt: now },
        },
      };
    }
    case "set-item-step": {
      const base = state.days[action.date] ?? action.draft;
      const items = base.items.map((item) => (item.id === action.itemId ? { ...item, step: action.step } : item));
      return {
        ...state,
        updatedAt: now,
        days: { ...state.days, [action.date]: { ...base, items, updatedAt: now } },
      };
    }
    case "set-progression":
      return {
        ...state,
        updatedAt: now,
        slots: {
          ...state.slots,
          [action.slotKey]: { exerciseId: action.exerciseId, step: action.step, updatedAt: now },
        },
      };
    case "log": {
      const base = state.days[action.date] ?? action.draft;
      const items = base.items.map((item) => {
        if (item.id !== action.entry.itemId) {
          if (action.itemStep && item.id === action.itemStep.itemId) return { ...item, step: action.itemStep.step, done: true };
          return item;
        }
        const stepped = action.itemStep && action.itemStep.itemId === item.id ? { step: action.itemStep.step } : {};
        return { ...item, ...stepped, done: true };
      });
      const slots = { ...state.slots };
      if (action.slot) {
        const { key, ...slot } = action.slot;
        slots[key] = { ...slot, updatedAt: now };
      }
      return {
        ...state,
        updatedAt: now,
        slots,
        days: { ...state.days, [action.date]: { ...base, items, updatedAt: now } },
        logs: [...state.logs.filter((entry) => entry.id !== action.entry.id), { ...action.entry, updatedAt: now }],
      };
    }
    case "save-favorite":
      return {
        ...state,
        updatedAt: now,
        favorites: [...state.favorites.filter((favorite) => favorite.id !== action.favorite.id), action.favorite],
      };
    case "delete-favorite":
      return {
        ...state,
        updatedAt: now,
        favorites: state.favorites.filter((favorite) => favorite.id !== action.id),
      };
    case "habit-check":
      return {
        ...state,
        updatedAt: now,
        habits: {
          ...state.habits,
          updatedAt: now,
          checks: { ...state.habits.checks, [action.key]: { done: action.done, updatedAt: now } },
        },
      };
    case "habit-profile":
      return {
        ...state,
        updatedAt: now,
        habits: {
          ...state.habits,
          height: action.height ?? state.habits.height,
          weight: action.weight ?? state.habits.weight,
          photoPath: action.photoPath ?? state.habits.photoPath,
          updatedAt: now,
        },
      };
    case "habit-unlock":
      return {
        ...state,
        updatedAt: now,
        habits: { ...state.habits, unlockedThrough: action.unlockedThrough, updatedAt: now },
      };
    case "set-rest":
      return touch(state, now, { ...state.meta, restSec: action.sec, updatedAt: now });
    case "set-library-root":
      return touch(state, now, { ...state.meta, libraryRoot: normalizeLibraryRoot(action.libraryRoot), updatedAt: now });
    case "reset-slots": {
      if (!state.meta.planId || state.meta.planId === "beginner") return state;
      return { ...state, updatedAt: now, slots: seedSlots(action.library, state.meta.planId, now) };
    }
    default:
      return state;
  }
}
