import { normalizeRel } from "./paths";

export interface ChapterCue {
  t: number;
  name: string;
  note?: string;
}

export interface ChaptersFile {
  version: 1;
  videos: Record<string, ChapterCue[]>;
}

export const EMPTY_CHAPTERS: ChaptersFile = { version: 1, videos: {} };

export function parseChapters(input: unknown): ChaptersFile {
  if (!input || typeof input !== "object" || Array.isArray(input)) return EMPTY_CHAPTERS;
  const record = input as { version?: unknown; videos?: unknown };
  if (record.version != null && record.version !== 1) return EMPTY_CHAPTERS;
  if (!record.videos || typeof record.videos !== "object" || Array.isArray(record.videos)) return EMPTY_CHAPTERS;

  const videos: Record<string, ChapterCue[]> = {};
  for (const [path, entries] of Object.entries(record.videos as Record<string, unknown>)) {
    const cues = parseCueList(entries);
    if (path.trim() && cues.length) videos[path] = cues;
  }
  return { version: 1, videos };
}

function parseCueList(entries: unknown): ChapterCue[] {
  if (!Array.isArray(entries)) return [];
  const parsed: { cue: ChapterCue; index: number }[] = [];
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as { t?: unknown; name?: unknown; note?: unknown };
    if (typeof row.t !== "number" || !Number.isFinite(row.t) || row.t < 0) return;
    if (typeof row.name !== "string") return;
    const name = row.name.trim();
    if (!name) return;
    const cue: ChapterCue = { t: row.t, name };
    if (typeof row.note === "string") {
      const note = row.note.trim();
      if (note) cue.note = note;
    }
    parsed.push({ cue, index });
  });
  parsed.sort((a, b) => a.cue.t - b.cue.t || a.index - b.index);
  return parsed.map((item) => item.cue);
}

/** Cues for a library video path. Exact key wins; otherwise slash-normalized match. */
export function lookupChapters(file: ChaptersFile | null | undefined, videoPath: string): ChapterCue[] {
  if (!file || !videoPath) return [];
  const exact = file.videos[videoPath];
  if (exact) return exact;
  const want = normalizeRel(videoPath);
  const normalized = file.videos[want];
  if (normalized) return normalized;
  for (const [key, cues] of Object.entries(file.videos)) {
    if (normalizeRel(key) === want) return cues;
  }
  return [];
}

/** Index of the cue that has started, or -1 before the first cue. */
export function activeChapterIndex(cues: readonly ChapterCue[], timeSeconds: number): number {
  if (!cues.length || !Number.isFinite(timeSeconds)) return -1;
  let active = -1;
  for (let index = 0; index < cues.length; index += 1) {
    if (cues[index].t <= timeSeconds) active = index;
    else break;
  }
  return active;
}

/** Clock label. Under an hour this is m:ss. Longer videos use h:mm:ss. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const secs = total % 60;
  const minutes = Math.floor(total / 60);
  const ss = String(secs).padStart(2, "0");
  if (minutes < 60) return `${minutes}:${ss}`;
  const hours = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hours}:${mm}:${ss}`;
}
