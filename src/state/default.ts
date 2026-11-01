import { DEFAULT_LIBRARY_ROOT } from "../lib/paths";
import type { AppState } from "../types";

export function createState(now = "1970-01-01T00:00:00.000Z"): AppState {
  return {
    version: 1,
    revision: 0,
    updatedAt: now,
    meta: { planId: null, quiz: null, restSec: 60, libraryRoot: DEFAULT_LIBRARY_ROOT, updatedAt: now },
    slots: {},
    days: {},
    logs: [],
    favorites: [],
    habits: {
      height: "",
      weight: "",
      photoPath: "",
      unlockedThrough: 1,
      checks: {},
      updatedAt: now,
    },
  };
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
