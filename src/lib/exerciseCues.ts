import type { ChapterCue } from "./chapters";
import type { LessonExercise } from "../types";

export interface ExerciseRow extends LessonExercise {
  index: number;
}

export function libraryExercisesWin(exercises: LessonExercise[], chapters: ChapterCue[]): boolean {
  if (!exercises.length) return false;
  const timed = exercises.reduce((count, exercise) => count + (validTime(exercise.t) ? 1 : 0), 0);
  return timed >= chapters.length;
}

/** Library exercises win when they have at least as many timed rows as chapter cues. */
export function buildExerciseRows(exercises: LessonExercise[], chapters: ChapterCue[]): ExerciseRow[] {
  if (libraryExercisesWin(exercises, chapters)) {
    return exercises.map((exercise, index) => ({ ...exercise, index }));
  }
  return chapters.map((cue, index) => {
    const row: ExerciseRow = { index, name: cue.name, t: cue.t };
    if (cue.note) row.cue = cue.note;
    return row;
  });
}

/** Timed rows only, sorted by t, with identical times collapsed to the first. */
export function timedRows(rows: ExerciseRow[]): ExerciseRow[] {
  const timed = rows.filter((row): row is ExerciseRow & { t: number } => validTime(row.t));
  const sorted = [...timed].sort((a, b) => a.t - b.t || a.index - b.index);
  const seen = new Set<number>();
  const out: ExerciseRow[] = [];
  for (const row of sorted) {
    if (seen.has(row.t)) continue;
    seen.add(row.t);
    out.push(row);
  }
  return out;
}

function validTime(t: number | undefined): t is number {
  return typeof t === "number" && Number.isFinite(t) && t >= 0;
}

export function readLessonExercises(value: unknown): LessonExercise[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const exercises: LessonExercise[] = [];
  for (const entry of value) {
    if (exercises.length >= 60) break;
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.name !== "string") continue;
    const name = row.name.trim();
    if (!name) continue;
    const exercise: LessonExercise = { name };
    const dose = optionalText(row.dose);
    const cue = optionalText(row.cue);
    const label = optionalText(row.label);
    if (dose) exercise.dose = dose;
    if (cue) exercise.cue = cue;
    if (label) exercise.label = label;
    if (typeof row.t === "number" && Number.isFinite(row.t) && row.t >= 0) exercise.t = Math.floor(row.t);
    exercises.push(exercise);
  }
  return exercises.length ? exercises : undefined;
}

export function readSummaryLine(value: unknown): string | undefined {
  const text = optionalText(value);
  return text ? text.slice(0, 240) : undefined;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
