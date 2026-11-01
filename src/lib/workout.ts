import { addDays, dowOf } from "./dates";
import { mobilityForStep } from "./ladders";
import type {
  AppState,
  DayItem,
  DayState,
  DayType,
  Exercise,
  Library,
  PlanId,
  SlotState,
  ViewDay,
  ViewItem,
  ViewVideo,
} from "../types";

export function exerciseById(library: Library, id: string | undefined): Exercise | undefined {
  if (!id) return undefined;
  return library.exercises.find((exercise) => exercise.id === id);
}

export function trackExercises(library: Library, slotKey: string): Exercise[] {
  return library.exercises
    .filter((exercise) => exercise.slotKey === slotKey)
    .sort((a, b) => a.level - b.level || a.order - b.order || a.name.localeCompare(b.name));
}

export function compareExercise(a: Exercise, b: Exercise): number {
  return a.level - b.level || a.order - b.order || a.name.localeCompare(b.name);
}

export function seedSlots(library: Library, planId: PlanId, now: string): Record<string, SlotState> {
  if (planId === "beginner") return {};
  const plan = library.plans.guided.find((item) => item.id === planId);
  const level = plan?.startLevel ?? 1;
  const slots: Record<string, SlotState> = {};
  for (const slot of library.plans.slots) {
    const exercises = trackExercises(library, slot.key);
    const first = exercises.find((exercise) => exercise.level === level) ?? exercises[0];
    if (first) slots[slot.key] = { exerciseId: first.id, step: 1, updatedAt: now };
  }
  return slots;
}

export function advanceSlot(
  exercises: Exercise[],
  current: { exerciseId: string; step: number },
  stayed: boolean,
): { exerciseId: string; step: number; mastered: boolean } {
  if (stayed) return { ...current, mastered: false };
  const index = exercises.findIndex((exercise) => exercise.id === current.exerciseId);
  const currentExercise = exercises[index];
  const length = currentExercise?.steps.length || 9;
  if (index === -1) return { ...current, mastered: false };
  if (current.step < length) return { exerciseId: current.exerciseId, step: current.step + 1, mastered: false };
  const next = exercises[index + 1];
  if (next) return { exerciseId: next.id, step: 1, mastered: false };
  return { exerciseId: current.exerciseId, step: current.step, mastered: true };
}

function mediaByTitle(library: Library, title: string | undefined): { title: string; path: string } | undefined {
  if (!title) return undefined;
  const pools = [
    ...library.media.warmups,
    ...library.media.mobility,
    library.media.stretches.front,
    library.media.stretches.middle,
    ...library.media.stretches.extra,
  ];
  return pools.find((item) => item.title === title);
}

function dayTypeDef(library: Library, dayType: DayType) {
  return library.plans.dayTypes.find((item) => item.id === dayType);
}

export function blankDay(date: string, source: DayState["source"], now = ""): DayState {
  return { date, source, items: [], updatedAt: now };
}

export function deriveGuidedDay(library: Library, state: AppState, date: string, now = ""): DayState {
  const planId = state.meta.planId;
  const plan = library.plans.guided.find((item) => item.id === planId);
  const template = library.plans.week.find((item) => item.dow === dowOf(date));
  const dayType = template?.dayType ?? "upper";
  const def = dayTypeDef(library, dayType);
  const items: DayItem[] = [];
  const stretchKind = def?.stretch;
  if (!stretchKind) {
    const warmup =
      mediaByTitle(library, plan?.warmupTitle) ??
      library.media.warmups[0];
    if (warmup) {
      items.push({ id: "warmup", kind: "warmup", title: warmup.title, path: warmup.path, done: false });
    }
    const mobility = mediaByTitle(library, template?.mobilityTitle);
    if (mobility) {
      items.push({ id: "mobility", kind: "mobility", title: mobility.title, path: mobility.path, done: false });
    }
  } else {
    const stretch = stretchKind === "front" ? library.media.stretches.front : library.media.stretches.middle;
    items.push({ id: "stretch", kind: "stretch", title: stretch.title, path: stretch.path, done: false });
  }
  for (const slotKey of def?.slots ?? []) {
    items.push({ id: `slot:${slotKey}`, kind: "strength", slotKey, done: false });
  }
  return { date, source: "guided", dayType, items, updatedAt: now };
}

export function beginnerDay(library: Library, date: string, workoutNumber: number, now: string): DayState {
  const workout = library.plans.beginner.workouts.find((item) => item.n === workoutNumber);
  const items: DayItem[] = (workout?.items ?? []).map((item, index) => ({
    id: `fa:${workoutNumber}:${index}`,
    kind: index === 0 ? "warmup" : "followalong",
    title: item.title,
    path: item.path,
    done: false,
  }));
  return {
    date,
    source: "beginner",
    beginnerWorkout: workoutNumber,
    items,
    updatedAt: now,
  };
}

export function withDayType(library: Library, state: AppState, date: string, dayType: DayType, now: string): DayState {
  const previous = state.days[date];
  const derived = deriveGuidedDay(library, state, date, now);
  const rebuilt = deriveGuidedDay(
    library,
    state,
    date,
    now,
  );
  // Rebuild from the requested type rather than the weekday default.
  const def = dayTypeDef(library, dayType);
  const items: DayItem[] = [];
  if (def?.stretch) {
    const stretch = def.stretch === "front" ? library.media.stretches.front : library.media.stretches.middle;
    items.push({ id: "stretch", kind: "stretch", title: stretch.title, path: stretch.path, done: false });
  } else {
    const warmup = previous?.items.find((item) => item.kind === "warmup") ?? derived.items.find((item) => item.kind === "warmup");
    const mobility = previous?.items.find((item) => item.kind === "mobility") ?? rebuilt.items.find((item) => item.kind === "mobility");
    if (warmup) items.push({ ...warmup, done: false });
    if (mobility) items.push({ ...mobility, done: false });
    for (const slotKey of def?.slots ?? []) {
      const old = previous?.items.find((item) => item.id === `slot:${slotKey}`);
      items.push({ id: `slot:${slotKey}`, kind: "strength", slotKey, done: old?.done ?? false });
    }
  }
  return { date, source: "guided", dayType, items, updatedAt: now };
}

function videosForExercise(exercise: Exercise): ViewVideo[] {
  const videos: ViewVideo[] = [];
  if (exercise.videos.strength) {
    videos.push({ role: "Strength", title: exercise.name, path: exercise.videos.strength });
  }
  exercise.videos.mobility.forEach((path, index) => {
    videos.push({
      role: "Mobility",
      title: exercise.mobilityName || `Mobility ${index + 1}`,
      path,
    });
  });
  exercise.videos.tech.forEach((path, index) => {
    videos.push({ role: "Technique", title: `Technique ${index + 1}`, path });
  });
  return videos;
}

function presentItem(library: Library, state: AppState, item: DayItem): ViewItem {
  if (item.kind === "strength" && item.slotKey) {
    const slot = state.slots[item.slotKey];
    const exercise = exerciseById(library, slot?.exerciseId);
    const slotMeta = library.plans.slots.find((entry) => entry.key === item.slotKey);
    if (!exercise || !slot) {
      return {
        id: item.id,
        kind: item.kind,
        title: slotMeta ? `${slotMeta.letter} ${slotMeta.endSkill}` : item.slotKey,
        subtitle: "Pick a progression",
        done: item.done,
        slotKey: item.slotKey,
        videos: [],
      };
    }
    const step = clampStep(slot.step, exercise.steps.length);
    const prescription = exercise.steps[step - 1];
    const mobility = prescription ? mobilityForStep(exercise.mobilityMastery, prescription) : undefined;
    return {
      id: item.id,
      kind: item.kind,
      title: `${slotMeta?.letter ?? ""} ${exercise.name}`.trim(),
      subtitle: `${slotMeta?.endSkill ?? exercise.track}`,
      prescription: prescription?.label,
      mobilityPrescription: mobility?.label,
      mobilityName: exercise.mobilityName,
      step,
      stepCount: exercise.steps.length,
      done: item.done,
      exerciseId: exercise.id,
      slotKey: item.slotKey,
      videos: videosForExercise(exercise),
      focus: exercise.focus,
      mastery: exercise.strengthMastery,
      mobilityMastery: exercise.mobilityMastery,
      steps: exercise.steps,
    };
  }
  if (item.kind === "strength" && item.exerciseId) {
    const exercise = exerciseById(library, item.exerciseId);
    if (!exercise) {
      return {
        id: item.id,
        kind: item.kind,
        title: item.title || item.exerciseId,
        done: item.done,
        exerciseId: item.exerciseId,
        videos: item.path ? [{ role: "Video", title: item.title || "Video", path: item.path }] : [],
        path: item.path,
      };
    }
    const step = clampStep(item.step ?? 1, exercise.steps.length);
    const prescription = exercise.steps[step - 1];
    const mobility = prescription ? mobilityForStep(exercise.mobilityMastery, prescription) : undefined;
    return {
      id: item.id,
      kind: item.kind,
      title: exercise.name,
      subtitle: exercise.track,
      prescription: prescription?.label,
      mobilityPrescription: mobility?.label,
      mobilityName: exercise.mobilityName,
      step,
      stepCount: exercise.steps.length,
      done: item.done,
      exerciseId: exercise.id,
      videos: videosForExercise(exercise),
      focus: exercise.focus,
      mastery: exercise.strengthMastery,
      mobilityMastery: exercise.mobilityMastery,
      steps: exercise.steps,
    };
  }
  const path = item.path;
  return {
    id: item.id,
    kind: item.kind,
    title: item.title || "Video",
    done: item.done,
    path,
    videos: path ? [{ role: labelKind(item.kind), title: item.title || "Video", path }] : [],
  };
}

function labelKind(kind: DayItem["kind"]): string {
  switch (kind) {
    case "warmup":
      return "Warm-up";
    case "mobility":
      return "Mobility";
    case "stretch":
      return "Stretch";
    case "skill":
      return "Skill";
    default:
      return "Follow along";
  }
}

function clampStep(step: number, length: number): number {
  if (length <= 0) return 1;
  return Math.min(Math.max(step, 1), length);
}

export function resolveDay(library: Library, state: AppState, date: string, today: string): ViewDay {
  const stored = state.days[date];
  if (stored?.cleared) {
    return { date, source: "rest", headline: "Rest day", items: [], stored: true, cleared: true };
  }
  if (stored) {
    return {
      date,
      source: stored.source,
      dayType: stored.dayType,
      headline: headlineFor(library, stored),
      items: stored.items.map((item) => presentItem(library, state, item)),
      stored: true,
      beginnerWorkout: stored.beginnerWorkout,
    };
  }
  const planId = state.meta.planId;
  if (!planId) {
    return { date, source: "empty", headline: "Choose a plan to start", items: [], stored: false };
  }
  if (date < today || planId === "beginner") {
    return {
      date,
      source: date < today ? "rest" : "empty",
      headline: date < today ? "Rest day" : "This day doesn't have a workout yet.",
      items: [],
      stored: false,
    };
  }
  const draft = deriveGuidedDay(library, state, date);
  return {
    date,
    source: "guided",
    dayType: draft.dayType,
    headline: headlineFor(library, draft),
    items: draft.items.map((item) => presentItem(library, state, item)),
    stored: false,
  };
}

function headlineFor(library: Library, day: DayState): string {
  if (day.source === "beginner" && day.beginnerWorkout) return `Beginner workout ${day.beginnerWorkout}`;
  if (day.source === "byo") return "Your workout";
  if (day.source === "rest") return "Rest day";
  const def = day.dayType ? dayTypeDef(library, day.dayType) : undefined;
  return def?.label ?? "Workout";
}

export function draftDay(library: Library, state: AppState, date: string, today: string, now: string): DayState {
  const stored = state.days[date];
  if (stored) return stored;
  if (state.meta.planId && state.meta.planId !== "beginner" && date >= today) {
    return { ...deriveGuidedDay(library, state, date, now), updatedAt: now };
  }
  return { date, source: state.meta.planId === "beginner" ? "beginner" : "rest", items: [], updatedAt: now };
}

export function cycleMedia(
  list: { title: string; path: string }[],
  currentPath: string | undefined,
  direction: 1 | -1,
): { title: string; path: string } | undefined {
  if (list.length === 0) return undefined;
  const index = list.findIndex((item) => item.path === currentPath);
  const next = index === -1 ? 0 : (index + direction + list.length) % list.length;
  return list[next];
}

export function replaceItem(day: DayState, itemId: string, next: Partial<DayItem>, now: string): DayState {
  return {
    ...day,
    updatedAt: now,
    items: day.items.map((item) => (item.id === itemId ? { ...item, ...next } : item)),
  };
}

export function collectVideos(view: ViewDay): { path: string; title: string }[] {
  const seen = new Set<string>();
  const videos: { path: string; title: string }[] = [];
  for (const item of view.items) {
    for (const video of item.videos) {
      if (!video.path || seen.has(video.path)) continue;
      seen.add(video.path);
      videos.push({ path: video.path, title: `${item.title} — ${video.title}` });
    }
  }
  return videos;
}

export function cloneItems(items: DayItem[]): DayItem[] {
  return items.map((item) => ({ ...item, done: false }));
}

export function previousWorkoutDate(state: AppState, date: string): string | undefined {
  return Object.keys(state.days)
    .filter((key) => key < date && state.days[key].items.length > 0 && !state.days[key].cleared)
    .sort()
    .at(-1);
}

export function sameWeekdayLastWeek(state: AppState, date: string): DayState | undefined {
  const prior = addDays(date, -7);
  const day = state.days[prior];
  if (!day || day.cleared || day.items.length === 0) return undefined;
  return day;
}

export function habitStreak(state: AppState, today: string): number {
  const unlocked = state.habits.unlockedThrough;
  let streak = 0;
  for (let i = 0; i < 28; i += 1) {
    const date = addDays(today, -i);
    if (dowOf(date) === 0) continue;
    const complete = tasksComplete(state, date, unlocked);
    if (!complete) {
      if (i === 0) continue;
      break;
    }
    streak += 1;
  }
  return streak;
}

export function tasksComplete(state: AppState, date: string, unlocked: number): boolean {
  for (let n = 1; n <= unlocked; n += 1) {
    const key = `${date}|t${String(n).padStart(2, "0")}`;
    if (!state.habits.checks[key]?.done) return false;
  }
  return unlocked > 0;
}

export function taskKey(date: string, n: number): string {
  return `${date}|t${String(n).padStart(2, "0")}`;
}
