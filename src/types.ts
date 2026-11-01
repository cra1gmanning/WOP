export const PLAN_IDS = [
  "beginner",
  "intermediate-one",
  "intermediate-two",
  "advanced-one",
  "advanced-two",
] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export type DayType =
  | "upper"
  | "core-lower"
  | "core-upper"
  | "stretch-front"
  | "stretch-middle";

export type ByoGroup = "push" | "pull" | "core" | "legs";

export interface Prescription {
  sets: number;
  amount: number;
  unit: "r" | "s" | "custom";
  perSide: boolean;
  holdSeconds?: number;
  suffix?: string;
  customLabel?: string;
  label: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  course: string;
  track: string;
  level: number;
  order: number;
  strengthMastery: string;
  mobilityMastery: string;
  mobilityName: string;
  steps: Prescription[];
  focus: { strength: string[]; mobility: string[] };
  videos: { strength?: string; mobility: string[]; tech: string[] };
  byoGroup?: ByoGroup;
  slotKey?: string;
}

export interface CourseVideo {
  title: string;
  path: string;
}

export interface CourseTrack {
  name: string;
  exerciseIds: string[];
  videos: CourseVideo[];
}

export interface Course {
  id: string;
  category: string;
  name: string;
  tracks: CourseTrack[];
}

export interface ClassPart {
  title: string;
  path: string;
}

export interface ClassItem {
  id: string;
  title: string;
  difficulty: string;
  type: string;
  minutes: number | null;
  description: string;
  parts: ClassPart[];
}

export interface MediaRef {
  title: string;
  path: string;
}

export interface FollowAlong {
  title: string;
  path: string;
  description?: string;
  duration?: string;
}

export interface BeginnerWorkout {
  n: number;
  items: FollowAlong[];
}

export interface PlanSlot {
  key: string;
  block: string;
  letter: string;
  track: string;
  endSkill: string;
}

export interface WeekDayTemplate {
  dow: number;
  label: string;
  dayType: DayType;
  mobilityTitle?: string;
}

export interface DayTypeDef {
  id: DayType;
  label: string;
  slots: string[];
  stretch?: "front" | "middle";
}

export interface GuidedPlan {
  id: Exclude<PlanId, "beginner">;
  name: string;
  warmupTitle: string;
  startLevel: number;
  summary: string;
}

export interface PlanData {
  beginner: {
    id: "beginner";
    name: string;
    summary: string;
    workouts: BeginnerWorkout[];
  };
  guided: GuidedPlan[];
  week: WeekDayTemplate[];
  dayTypes: DayTypeDef[];
  slots: PlanSlot[];
}

export interface QuizOption {
  label: string;
}

export interface QuizQuestion {
  title: string;
  prompt: string;
  options: QuizOption[];
}

export interface QuizLevel {
  id: PlanId;
  name: string;
  summary: string;
  summarySource: "quoted" | "reconstructed";
}

export interface QuizData {
  intro: string;
  questions: QuizQuestion[];
  levels: QuizLevel[];
  blurbs: Record<string, string>;
  blurbSources: Record<string, "quoted" | "reconstructed">;
}

export interface HabitLesson {
  id: string;
  task: number;
  role: "task" | "note";
  title: string;
  path?: string;
  body: string;
}

export interface HabitTask {
  id: string;
  n: number;
  label: string;
  detail: string;
  lessonId: string;
  noteId?: string;
}

export interface HabitData {
  overview: string;
  tasks: HabitTask[];
  lessons: HabitLesson[];
}

export interface EquipmentGroup {
  course: string;
  items: string[];
}

export interface Library {
  version: 1;
  generatedAt: string;
  rootFolder: string;
  exercises: Exercise[];
  courses: Course[];
  classes: ClassItem[];
  plans: PlanData;
  quiz: QuizData;
  habits: HabitData;
  equipment: EquipmentGroup[];
  media: {
    warmups: MediaRef[];
    mobility: MediaRef[];
    stretches: { front: MediaRef; middle: MediaRef; extra: MediaRef[] };
  };
}

export interface SlotState {
  exerciseId: string;
  step: number;
  updatedAt: string;
}

export interface DayItem {
  id: string;
  kind: "warmup" | "mobility" | "stretch" | "followalong" | "strength" | "skill";
  title?: string;
  path?: string;
  exerciseId?: string;
  slotKey?: string;
  step?: number;
  done: boolean;
}

export interface DayState {
  date: string;
  source: "guided" | "byo" | "beginner" | "rest";
  dayType?: DayType;
  beginnerWorkout?: number;
  items: DayItem[];
  cleared?: boolean;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  date: string;
  itemId?: string;
  exerciseId?: string;
  slotKey?: string;
  title: string;
  block?: string;
  kind: "log" | "check";
  step?: number;
  prescription?: string;
  unit?: Prescription["unit"];
  target?: number;
  sets?: number[];
  perSide?: boolean;
  mobilityDone?: boolean;
  mobilityLabel?: string;
  stayed?: boolean;
  advanced?: boolean;
  note?: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Favorite {
  id: string;
  name: string;
  items: DayItem[];
  updatedAt: string;
}

export interface HabitCheck {
  done: boolean;
  updatedAt: string;
}

export interface AppState {
  version: 1;
  revision: number;
  updatedAt: string;
  meta: {
    planId: PlanId | null;
    quiz: { answers: number[]; level: PlanId; takenAt: string } | null;
    restSec: number;
    /** OneDrive folder that holds the library. No leading slash. */
    libraryRoot: string;
    updatedAt: string;
  };
  slots: Record<string, SlotState>;
  days: Record<string, DayState>;
  logs: LogEntry[];
  favorites: Favorite[];
  habits: {
    height: string;
    weight: string;
    photoPath: string;
    unlockedThrough: number;
    checks: Record<string, HabitCheck>;
    updatedAt: string;
  };
}

export interface ViewVideo {
  role: string;
  title: string;
  path: string;
}

export interface ViewItem {
  id: string;
  kind: DayItem["kind"];
  title: string;
  subtitle?: string;
  prescription?: string;
  mobilityPrescription?: string;
  mobilityName?: string;
  step?: number;
  stepCount?: number;
  done: boolean;
  exerciseId?: string;
  slotKey?: string;
  videos: ViewVideo[];
  path?: string;
  focus?: { strength: string[]; mobility: string[] };
  mastery?: string;
  mobilityMastery?: string;
  steps?: Prescription[];
}

export interface ViewDay {
  date: string;
  source: DayState["source"] | "empty";
  dayType?: DayType;
  headline: string;
  items: ViewItem[];
  stored: boolean;
  cleared?: boolean;
  beginnerWorkout?: number;
}
