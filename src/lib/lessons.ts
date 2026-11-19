import type { CourseLessonItem, CourseTrack, CourseVideo, LessonExercise, Library, LibraryAttachment } from "../types";
import { readLessonExercises, readSummaryLine } from "./exerciseCues";
import { normalizeRel } from "./paths";

export interface ResolvedLesson {
  kind: "video" | "text";
  title: string;
  path?: string;
  description?: string;
  html?: string;
  attachments: LibraryAttachment[];
  relatedPaths: string[];
  exercises: LessonExercise[];
  summaryLine?: string;
  courseId: string;
}

export type TrackRow =
  | { kind: "exercise"; id: string }
  | { kind: "video"; title: string; path: string }
  | { kind: "text"; title: string };

export function fileTitle(path: string): string {
  const base = path.split(/[/\\]/).pop() || "Video";
  return base.replace(/\.mp4$/i, "") || "Video";
}

/** Lesson rows for a track. A non-empty `items` list replaces `videos`. */
export function trackRows(track: CourseTrack): TrackRow[] {
  const items = readItems(track.items);
  if (!items) return legacyRows(track);
  const rows: TrackRow[] = items.map((item) =>
    item.kind === "text"
      ? { kind: "text", title: item.title }
      : { kind: "video", title: item.title, path: item.path },
  );
  return [...rows, ...exerciseRows(track)];
}

export function findTextLesson(library: Library, courseId: string, title: string): ResolvedLesson | null {
  const want = title.trim();
  if (!want) return null;
  for (const course of library.courses ?? []) {
    if (course.id !== courseId) continue;
    for (const track of course.tracks ?? []) {
      for (const item of readItems(track.items) ?? []) {
        if (item.kind === "text" && item.title === want) return toResolved(course.id, item);
      }
    }
  }
  return null;
}

export function findVideoLesson(library: Library, path: string): ResolvedLesson | null {
  const want = normalizeRel(path);
  if (!want) return null;
  let best: ResolvedLesson | null = null;
  for (const course of library.courses ?? []) {
    for (const track of course.tracks ?? []) {
      for (const item of readItems(track.items) ?? []) {
        if (item.kind !== "video" || normalizeRel(item.path) !== want) continue;
        best = prefer(best, toResolved(course.id, item));
      }
      for (const video of track.videos ?? []) {
        if (!video || typeof video !== "object") continue;
        const item = readItem({ ...video, kind: "video" });
        if (!item || item.kind !== "video" || normalizeRel(item.path) !== want) continue;
        best = prefer(best, toResolved(course.id, item));
      }
    }
  }
  return best;
}

export function videoTitle(library: Library, path: string): string {
  return findVideoLesson(library, path)?.title || fileTitle(path);
}

function prefer(current: ResolvedLesson | null, next: ResolvedLesson): ResolvedLesson {
  if (!current || lessonScore(next) > lessonScore(current)) return next;
  return current;
}

function lessonScore(lesson: ResolvedLesson): number {
  return (lesson.html ? 4 : 0)
    + (lesson.description ? 2 : 0)
    + (lesson.exercises.length ? 3 : 0)
    + lesson.attachments.length
    + lesson.relatedPaths.length;
}

function legacyRows(track: CourseTrack): TrackRow[] {
  return [...exerciseRows(track), ...videoRows(track.videos)];
}

function exerciseRows(track: CourseTrack): TrackRow[] {
  const rows: TrackRow[] = [];
  const seen = new Set<string>();
  for (const id of track.exerciseIds ?? []) {
    if (typeof id !== "string" || !id.trim() || seen.has(id)) continue;
    seen.add(id);
    rows.push({ kind: "exercise", id });
  }
  return rows;
}

function videoRows(videos: CourseVideo[] | undefined): TrackRow[] {
  const rows: TrackRow[] = [];
  for (const video of videos ?? []) {
    if (!video || typeof video !== "object") continue;
    const item = readItem({ ...video, kind: "video" });
    if (!item || item.kind !== "video") continue;
    rows.push({ kind: "video", title: item.title, path: item.path });
  }
  return rows;
}

function readItems(value: unknown): CourseLessonItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: CourseLessonItem[] = [];
  for (const entry of value) {
    const item = readItem(entry);
    if (item) items.push(item);
  }
  return items.length ? items : null;
}

function readItem(entry: unknown): CourseLessonItem | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) return null;
  const shared = {
    title,
    description: presentText(row.description),
    html: presentText(row.html),
    attachments: readAttachments(row.attachments),
    relatedPaths: readPaths(row.relatedPaths),
  };
  if (row.kind === "text") return { kind: "text", ...shared };
  if (row.kind !== "video") return null;
  const path = typeof row.path === "string" ? row.path.trim() : "";
  if (!path) return null;
  return {
    kind: "video",
    path,
    ...shared,
    exercises: readLessonExercises(row.exercises),
    summaryLine: readSummaryLine(row.summaryLine),
  };
}

function presentText(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value;
}

function readPaths(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const paths = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim());
  return paths.length ? paths : undefined;
}

function readAttachments(value: unknown): LibraryAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments: LibraryAttachment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (row.kind !== "image" && row.kind !== "pdf") continue;
    const path = typeof row.path === "string" ? row.path.trim() : "";
    if (!path) continue;
    const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : fileTitle(path);
    attachments.push({ title, path, kind: row.kind });
  }
  return attachments.length ? attachments : undefined;
}

function toResolved(courseId: string, item: CourseLessonItem): ResolvedLesson {
  return {
    kind: item.kind,
    title: item.title,
    path: item.kind === "video" ? item.path : undefined,
    description: item.description,
    html: item.html,
    attachments: item.attachments ?? [],
    relatedPaths: item.relatedPaths ?? [],
    exercises: item.kind === "video" ? item.exercises ?? [] : [],
    summaryLine: item.kind === "video" ? item.summaryLine : undefined,
    courseId,
  };
}
