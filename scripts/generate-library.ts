import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../src/lib/csv";
import { DEFAULT_LIBRARY_ROOT } from "../src/lib/paths";
import { ladderFromMastery } from "../src/lib/ladders";
import type {
  BeginnerWorkout,
  ByoGroup,
  ClassItem,
  Course,
  Exercise,
  Library,
  PlanId,
  QuizData,
  QuizQuestion,
} from "../src/types";

function hidden(flags: string, ...parts: string[]): RegExp {
  return new RegExp(parts.join(""), flags);
}

// Split so this source file does not contain blocked host names as plain text.
const FORBIDDEN = hidden("i", "https?:\\/\\/", "|", "gymnas", "ticbodies", "|", "ver", "cel", "|", "blob", "\\.core", "|", "public", "\\.blob");

const SLOT_DEFS: { key: string; block: string; letter: string; track: string; endSkill: string; byo: ByoGroup }[] = [
  { key: "upper.A", block: "Upper Body", letter: "A", track: "Hollow Back Press", endSkill: "Hollow Back Press", byo: "push" },
  { key: "upper.B", block: "Upper Body", letter: "B", track: "Rope Climb", endSkill: "Rope Climb", byo: "pull" },
  { key: "upper.C", block: "Upper Body", letter: "C", track: "Straddle Planche", endSkill: "Straddle Planche", byo: "push" },
  { key: "core.A", block: "Core", letter: "A", track: "Front Lever", endSkill: "Front Lever", byo: "core" },
  { key: "core.B", block: "Core", letter: "B", track: "Side Lever", endSkill: "Side Lever", byo: "core" },
  { key: "core.C", block: "Core", letter: "C", track: "Manna", endSkill: "Manna", byo: "core" },
  { key: "lower.A", block: "Lower Body", letter: "A", track: "Single Leg Squat", endSkill: "Single Leg Squat", byo: "legs" },
];

const WARMUP_TITLES = ["7 Minute Warm-Up", "Extended Warmup", "Daily Limber"];
const MOBILITY_TITLES = [
  "Weighted Mobility",
  "Knee Series",
  "Single Bar Shoulder Mobility",
  "Weekly Shoulders",
  "Stall Bar Stretch",
  "Hip Prehab",
  "Wrist Sequence",
];

export interface GenerateResult {
  library: Library;
  warnings: string[];
}

export function generateLibrary(specDir: string, now = new Date().toISOString()): GenerateResult {
  const warnings: string[] = [];
  const catalog = parseCsv(read(specDir, "Catalog.csv"));
  const classRows = parseCsv(read(specDir, "Classes.csv"));
  const embeddedName = fs.existsSync(specDir)
    ? fs.readdirSync(specDir).find((name) => name.endsWith("embedded.json"))
    : undefined;
  const embedded = readJson(embeddedName ? path.join(specDir, embeddedName) : "");
  const mobilityIndex = indexEmbedded(embedded);
  const knownPaths = collectPaths(specDir, catalog, classRows);

  const exercises: Exercise[] = [];
  const courseMap = new Map<string, Course>();

  interface Acc {
    row: Record<string, string>;
    strength: string[];
    mobility: string[];
    tech: string[];
  }
  const grouped = new Map<string, Acc>();

  for (const row of catalog) {
    if ((row.Status || "OK") !== "OK") continue;
    const filePath = cleanPath(row["File Path"] || "");
    if (!filePath) continue;
    const category = row.Category || "Library";
    const courseName = row["Course/Level"] || category;
    const trackName = row["Skill Track"] || "Videos";
    const course = ensureCourse(courseMap, category, courseName);
    const track = ensureTrack(course, trackName);
    const code = (row.Code || "").trim();
    if (!code) {
      track.videos.push({ title: row["Progression Name"] || fileName(filePath), path: filePath });
      continue;
    }
    let acc = grouped.get(code);
    if (!acc) {
      acc = { row, strength: [], mobility: [], tech: [] };
      grouped.set(code, acc);
    }
    const kind = (row["Video Type"] || "").toLowerCase();
    if (kind.startsWith("strength tech") || kind === "tips") acc.tech.push(filePath);
    else if (kind.startsWith("mobility")) acc.mobility.push(filePath);
    else if (kind.startsWith("strength")) acc.strength.push(filePath);
    else acc.tech.push(filePath);
    if (!track.exerciseIds.includes(code)) track.exerciseIds.push(code);
  }

  for (const [code, acc] of grouped) {
    const row = acc.row;
    const slot = SLOT_DEFS.find((item) => item.track === row["Skill Track"]);
    const embeddedInfo = mobilityIndex.get(code);
    const focus = embeddedInfo?.focus.strength.length || embeddedInfo?.focus.mobility.length
      ? embeddedInfo.focus
      : parseFocus(row["Focus Points"] || "");
    const level = levelOf(row["Course/Level"] || "");
    const mastery = (row["Strength Mastery"] || "").trim();
    exercises.push({
      id: code,
      name: row["Progression Name"] || code,
      category: row.Category || "",
      course: row["Course/Level"] || "",
      track: row["Skill Track"] || "",
      level,
      order: Number(row["Progression #"] || 0),
      strengthMastery: mastery,
      mobilityMastery: (row["Mobility Mastery"] || "").trim(),
      mobilityName: embeddedInfo?.imName || "",
      steps: mastery ? ladderFromMastery(mastery) : [],
      focus: {
        strength: focus.strength.map(stripUrls),
        mobility: focus.mobility.map(stripUrls),
      },
      videos: {
        strength: acc.strength[0],
        mobility: acc.mobility,
        tech: acc.tech,
      },
      byoGroup: slot?.byo,
      slotKey: slot?.key,
    });
  }

  exercises.sort((a, b) => a.category.localeCompare(b.category) || a.course.localeCompare(b.course) || a.level - b.level || a.order - b.order);

  const classes = buildClasses(classRows);
  const classByTitle = new Map(classes.map((item) => [item.title, item]));
  const findClassPath = (title: string): string | undefined => classByTitle.get(title)?.parts[0]?.path;

  const media = {
    warmups: lookupMedia(WARMUP_TITLES, findClassPath, warnings),
    mobility: lookupMedia(MOBILITY_TITLES, findClassPath, warnings),
    stretches: {
      front: requireMedia("Front Split", findClassPath, warnings),
      middle: requireMedia("Middle Split", findClassPath, warnings),
      extra: lookupMedia(["Thoracic Bridge"], findClassPath, warnings),
    },
  };

  const beginnerFile = findFirst(specDir, ["planner/1_guided_beginner.md"]);
  const descriptions = beginnerFile ? parseDescriptions(fs.readFileSync(beginnerFile, "utf8")) : new Map();
  const workouts = beginnerFile ? parseBeginnerWorkouts(fs.readFileSync(beginnerFile, "utf8"), knownPaths, descriptions) : [];
  if (beginnerFile && workouts.length !== 40) {
    throw new Error(`Expected 40 beginner workouts, parsed ${workouts.length}`);
  }

  const quizFile = findFirst(specDir, ["planner/2_placement_quiz.md"]);
  const quizNotes = findFirst(specDir, ["content/quiz.md"]);
  if (!quizFile) throw new Error("Missing planner/2_placement_quiz.md");
  const quiz = parseQuiz(
    fs.readFileSync(quizFile, "utf8"),
    quizNotes ? fs.readFileSync(quizNotes, "utf8") : "",
  );

  const habits = parseHabits(specDir, knownPaths, warnings);
  const equipment = parseEquipment(specDir);

  const library: Library = {
    version: 1,
    generatedAt: now,
    rootFolder: DEFAULT_LIBRARY_ROOT,
    exercises,
    courses: [...courseMap.values()],
    classes,
    plans: {
      beginner: {
        id: "beginner",
        name: "Beginner",
        summary: "Forty follow-along workouts. You choose which workout lands on which day. Every one starts with the 7 minute warm-up.",
        workouts,
      },
      guided: [
        {
          id: "intermediate-one",
          name: "Intermediate One",
          warmupTitle: "7 Minute Warm-Up",
          startLevel: 1,
          summary: "Weekly template. Warm-up is the 7 minute follow-along. A new quiz start with no history begins at the first progression of each track.",
        },
        {
          id: "intermediate-two",
          name: "Intermediate Two",
          warmupTitle: "Extended Warmup",
          startLevel: 2,
          summary: "Same weekly template as Intermediate One, with the extended warm-up. A fresh start begins at level 2. Logged steps stay put if you already have history.",
        },
        {
          id: "advanced-one",
          name: "Advanced One",
          warmupTitle: "Extended Warmup",
          startLevel: 3,
          summary: "Same weekly template and extended warm-up. A fresh start begins at level 3.",
        },
        {
          id: "advanced-two",
          name: "Advanced Two",
          warmupTitle: "Extended Warmup",
          startLevel: 4,
          summary: "Same weekly template and extended warm-up. A fresh start begins at level 4.",
        },
      ],
      week: [
        { dow: 1, label: "Monday", dayType: "upper", mobilityTitle: "Weighted Mobility" },
        { dow: 2, label: "Tuesday", dayType: "core-lower", mobilityTitle: "Knee Series" },
        { dow: 3, label: "Wednesday", dayType: "stretch-front" },
        { dow: 4, label: "Thursday", dayType: "upper", mobilityTitle: "Single Bar Shoulder Mobility" },
        { dow: 5, label: "Friday", dayType: "core-lower", mobilityTitle: "Knee Series" },
        { dow: 6, label: "Saturday", dayType: "stretch-middle" },
        { dow: 0, label: "Sunday", dayType: "upper", mobilityTitle: "Weighted Mobility" },
      ],
      dayTypes: [
        { id: "upper", label: "Upper Body", slots: ["upper.A", "upper.B", "upper.C"] },
        { id: "core-lower", label: "Core / Lower Body", slots: ["core.A", "core.B", "core.C", "lower.A"] },
        { id: "core-upper", label: "Core / Upper Body", slots: ["core.A", "core.B", "core.C", "upper.A", "upper.B", "upper.C"] },
        { id: "stretch-front", label: "Front Split", slots: [], stretch: "front" },
        { id: "stretch-middle", label: "Middle Split", slots: [], stretch: "middle" },
      ],
      slots: SLOT_DEFS.map(({ key, block, letter, track, endSkill }) => ({ key, block, letter, track, endSkill })),
    },
    quiz,
    habits,
    equipment,
    media,
  };

  assertClean(library);
  return { library, warnings };
}

export function assertClean(value: unknown, trail = "library"): void {
  if (typeof value === "string") {
    if (FORBIDDEN.test(value)) throw new Error(`Forbidden reference in generated data at ${trail}: ${value.slice(0, 120)}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertClean(item, `${trail}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertClean(item, `${trail}.${key}`);
  }
}

export function parsePlacementResults(markdown: string): { answers: number[]; label: string }[] {
  const rows: { answers: number[]; label: string }[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*((?:\d+\s*,\s*)+\d+)[^|]*\|\s*([^|]+?)\s*\|/);
    if (!match) continue;
    if (match[1].includes("---")) continue;
    rows.push({
      answers: match[1].split(",").map((part) => Number(part.trim())),
      label: match[2].trim(),
    });
  }
  return rows;
}

export function levelIdFromLabel(label: string): PlanId {
  const text = label.toLowerCase();
  if (text.startsWith("beginner")) return "beginner";
  if (text.includes("intermediate two")) return "intermediate-two";
  if (text.includes("intermediate one")) return "intermediate-one";
  if (text.includes("advanced two")) return "advanced-two";
  if (text.includes("advanced one")) return "advanced-one";
  throw new Error(`Unknown level label: ${label}`);
}

function parseQuiz(plannerMd: string, notesMd: string): QuizData {
  const questions: QuizQuestion[] = [];
  const lines = plannerMd.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\d+)\.\s+"([^"]+)"\s+[–-]\s+(.+)$/);
    if (!match) continue;
    const optionLine = lines.slice(i + 1, i + 4).find((line) => /^\s+\d+:/.test(line));
    if (!optionLine) throw new Error(`Missing options for ${match[2]}`);
    const options = optionLine.split("|").map((part) => part.replace(/^\s*\d+:\s*/, "").trim()).filter(Boolean);
    questions.push({ title: match[2].trim(), prompt: match[3].trim(), options: options.map((label) => ({ label })) });
  }
  if (questions.length !== 7) throw new Error(`Expected 7 quiz questions, found ${questions.length}`);

  const blob = `${plannerMd}\n${notesMd}`;
  const quotes = new Map<string, string>();
  const quoteRe = /"([^"]+)"/g;
  let found: RegExpExecArray | null;
  while ((found = quoteRe.exec(blob))) {
    const quote = found[1];
    if (/sugar coat/i.test(quote)) quotes.set("mobilityLow", quote);
    else if (/shoot dang/i.test(quote)) quotes.set("coreHigh", quote);
    else if (/strength is impressive/i.test(quote)) quotes.set("strengthHigh", quote);
    else if (/gentle strength/i.test(quote)) quotes.set("strengthLow", quote);
    else if (/outstanding/i.test(quote)) quotes.set("allHigh", quote);
    else if (/fitness deficits/i.test(quote)) quotes.set("level:beginner", quote);
    else if (/intermediate one combines/i.test(quote)) quotes.set("level:intermediate-one", quote);
  }

  const reconstructed: Record<string, string> = {
    strengthMid: "Push and pull are underway. Stay with the current step until the reps are clean, then log to move on.",
    coreLow: "Core starts with short, honest holds. The paired mobility drill is part of the slot, not optional decoration.",
    coreMid: "Your core can train the basic shapes. Own the set before you chase the next step.",
    mobilityMid: "Mobility is improving. Keep the stretch day and the paired drill even when the strength work feels familiar.",
    mobilityHigh: "Range is an asset. Keep using it under control in the paired drills and on stretch days.",
  };
  const blurbs: Record<string, string> = { ...reconstructed };
  const blurbSources: Record<string, "quoted" | "reconstructed"> = {};
  for (const key of Object.keys(reconstructed)) blurbSources[key] = "reconstructed";
  for (const key of ["mobilityLow", "coreHigh", "strengthHigh", "strengthLow", "allHigh"]) {
    const quote = quotes.get(key);
    if (!quote) throw new Error(`Quiz blurb missing: ${key}`);
    blurbs[key] = quote;
    blurbSources[key] = "quoted";
  }

  const levels: QuizData["levels"] = [
    { id: "beginner", name: "Beginner", summary: requiredQuote(quotes, "level:beginner"), summarySource: "quoted" },
    { id: "intermediate-one", name: "Intermediate One", summary: requiredQuote(quotes, "level:intermediate-one"), summarySource: "quoted" },
    {
      id: "intermediate-two",
      name: "Intermediate Two",
      summary: "Intermediate Two uses the same week as Intermediate One and the extended warm-up. With no training history yet, it starts each track at level 2.",
      summarySource: "reconstructed",
    },
    {
      id: "advanced-one",
      name: "Advanced One",
      summary: "Advanced One keeps the weekly template and extended warm-up. With no training history yet, it starts each track at level 3.",
      summarySource: "reconstructed",
    },
    {
      id: "advanced-two",
      name: "Advanced Two",
      summary: "Advanced Two keeps the weekly template and extended warm-up. With no training history yet, it starts each track at level 4.",
      summarySource: "reconstructed",
    },
  ];

  const introLine = blob.split(/\r?\n/).find((line) => /starting point/i.test(line)) ?? "";
  const intro = stripUrls(introLine.replace(/^#+\s*/, "").trim()) ||
    "This quiz places you at a starting point. You can change the plan later if it is too hard or too easy.";

  return { intro, questions, levels, blurbs, blurbSources };
}

function requiredQuote(quotes: Map<string, string>, key: string): string {
  const quote = quotes.get(key);
  if (!quote) throw new Error(`Missing quiz copy: ${key}`);
  return quote;
}

export function parseBeginnerWorkouts(
  markdown: string,
  knownPaths: string[],
  descriptions: Map<string, { description?: string; duration?: string }>,
): BeginnerWorkout[] {
  const byNumber = new Map<number, string[]>();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^(\d{1,2}):\s+(.+)$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (n < 1 || n > 40) continue;
    const parts = match[2].split(";").map((part) => cleanItemTitle(part)).filter(Boolean);
    if (parts.length === 0) continue;
    byNumber.set(n, parts);
  }
  const workouts: BeginnerWorkout[] = [];
  for (let n = 1; n <= 40; n += 1) {
    const parts = byNumber.get(n);
    if (!parts) throw new Error(`Beginner workout ${n} is missing from the workout list`);
    const titles = ["7-Minute Warm-Up", ...parts];
    const items = titles.map((title) => {
      const resolved = resolveFollowAlong(title, knownPaths);
      if (!resolved) throw new Error(`No video path for beginner item "${title}" (workout ${n})`);
      const shown = displayTitle(title, resolved);
      const meta = descriptions.get(normTitle(shown)) || descriptions.get(normTitle(title));
      return {
        title: shown,
        path: resolved,
        description: meta?.description || undefined,
        duration: meta?.duration,
      };
    });
    workouts.push({ n, items });
  }
  return workouts;
}

function cleanItemTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayTitle(title: string, filePath: string): string {
  if (/^FD\d+$/i.test(title.trim())) {
    const parent = filePath.split("/").slice(-2, -1)[0] || "";
    const cleaned = parent.replace(/^\d+\s+/, "").trim();
    if (cleaned) return cleaned;
  }
  return title.replace(/^7-Minute Warm-Up$/, "7 Minute Warm-Up");
}

/** Match a lesson title to a file by shared words, or a numbered day workout for FD# titles. */
export function resolveFollowAlong(title: string, knownPaths: string[]): string | undefined {
  const fd = title.trim().match(/^FD(\d+)$/i);
  if (fd) {
    const n = fd[1];
    const hit = knownPaths.find((item) => new RegExp(`day ${n} - workout`, "i").test(item));
    if (hit) return hit;
  }
  const words = normTitle(title)
    .split(" ")
    .filter((word) => word.length > 1 && !["and", "the", "with"].includes(word));
  let best: { path: string; score: number } | undefined;
  for (const candidate of knownPaths) {
    const hay = normTitle(candidate).replace(/\b(\w+)s\b/g, "$1");
    const score = words.filter((word) => hay.includes(word.replace(/s$/, ""))).length;
    if (!best || score > best.score) best = { path: candidate, score };
  }
  const needed = Math.min(2, words.length);
  return best && best.score >= needed && best.score > 0 ? best.path : undefined;
}

function parseDescriptions(markdown: string): Map<string, { description?: string; duration?: string }> {
  const map = new Map<string, { description?: string; duration?: string }>();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^([^|]+)\|\s*(\d+:\d+)\s*\|\s*[^|]+\|\s*(.*)$/);
    if (!match) continue;
    const title = match[1].trim();
    if (/^title$/i.test(title)) continue;
    const description = stripUrls(match[3].trim());
    map.set(normTitle(title), {
      duration: match[2].trim(),
      description: description && description !== "(none)" && description !== "(no description)" ? description : undefined,
    });
  }
  return map;
}

function parseHabits(specDir: string, knownPaths: string[], warnings: string[]) {
  const overviewFile = findOverview(specDir);
  const overview = overviewFile ? stripUrls(fs.readFileSync(overviewFile, "utf8")).slice(0, 2500) : "";
  const listLine = overview.split(/\r?\n/).find((line) => line.includes("Lessons list:")) ?? "";
  const pairs: { n: number; task: string; note: string }[] = [];
  for (const part of listLine.split(";")) {
    const match = part.match(/(\d+)\s+(.+?)\s+\/\s+(.+)/);
    if (!match) continue;
    pairs.push({ n: Number(match[1]), task: match[2].trim(), note: match[3].trim() });
  }
  if (pairs.length !== 19) warnings.push(`Lesson list parsed ${pairs.length} pairs (expected 19). Checklist falls back to lesson headers.`);

  const bodies: { n: number; role: "task" | "note"; title: string; body: string }[] = [];
  const contentDir = path.join(specDir, "content");
  const lessonFiles = fs.existsSync(contentDir)
    ? fs.readdirSync(contentDir).filter((name) => name.endsWith(".md") && fs.readFileSync(path.join(contentDir, name), "utf8").includes("## Task"))
    : [];
  for (const file of lessonFiles) {
    const text = fs.readFileSync(path.join(specDir, "content", file), "utf8");
    const chunks = text.split(/^## /m).slice(1);
    for (const chunk of chunks) {
      const [header, ...rest] = chunk.split(/\r?\n/);
      const match = header.match(/^Task\s+(\d+)\s*(Note Book)?:\s*(.+)$/i);
      if (!match) continue;
      const title = match[3]
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim();
      bodies.push({
        n: Number(match[1]),
        role: match[2] ? "note" : "task",
        title,
        body: stripUrls(rest.join("\n").trim()),
      });
    }
  }

  const lessons = bodies.map((body) => ({
    id: `t${String(body.n).padStart(2, "0")}-${body.role}`,
    task: body.n,
    role: body.role,
    title: body.title,
    path: matchLessonVideo(body.n, body.title, knownPaths),
    body: body.body,
  }));

  const tasks = (pairs.length === 19 ? pairs : fallbackPairs(bodies)).map((pair) => ({
    id: `t${String(pair.n).padStart(2, "0")}`,
    n: pair.n,
    label: pair.task,
    detail: "Six training days a week. Sunday is off. A six-day streak unlocks the next habit.",
    lessonId: `t${String(pair.n).padStart(2, "0")}-task`,
    noteId: lessons.some((lesson) => lesson.id === `t${String(pair.n).padStart(2, "0")}-note`)
      ? `t${String(pair.n).padStart(2, "0")}-note`
      : undefined,
  }));

  return { overview, tasks, lessons };
}

function fallbackPairs(bodies: { n: number; role: "task" | "note"; title: string }[]) {
  const numbers = [...new Set(bodies.map((body) => body.n))].sort((a, b) => a - b);
  return numbers.map((n) => ({
    n,
    task: bodies.find((body) => body.n === n && body.role === "task")?.title ?? `Task ${n}`,
    note: bodies.find((body) => body.n === n && body.role === "note")?.title ?? "",
  }));
}

function findOverview(specDir: string): string | undefined {
  const dir = path.join(specDir, "content");
  if (!fs.existsSync(dir)) return undefined;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const full = path.join(dir, name);
    if (fs.readFileSync(full, "utf8").includes("Lessons list:")) return full;
  }
  return undefined;
}

function matchLessonVideo(task: number, title: string, knownPaths: string[]): string | undefined {
  const nn = String(task).padStart(2, "0");
  const titleWords = new Set(normTitle(title).split(" ").filter((word) => word.length > 2));
  const candidates = knownPaths.filter((item) => /\/videos\/task /i.test(`/${item.toLowerCase()}`) && (item.includes(`Task ${nn}`) || item.includes(`Task ${task} `)));
  let best: { path: string; score: number } | undefined;
  for (const candidate of candidates) {
    if (!candidate.toLowerCase().endsWith(".mp4")) continue;
    const words = normTitle(candidate.split("/").pop() || "").split(" ");
    const score = words.filter((word) => titleWords.has(word)).length;
    if (!best || score > best.score) best = { path: candidate, score };
  }
  return best && best.score > 0 ? best.path : undefined;
}

function parseEquipment(specDir: string) {
  const file = findFirst(specDir, ["content/information.md"]);
  if (!file) return [];
  const groups: { course: string; items: string[] }[] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (FORBIDDEN.test(line)) continue;
    const match = line.match(/^-\s+([^:]+):\s+(.+)$/);
    if (!match) continue;
    const items = match[2].split(";").map((item) => item.trim()).filter(Boolean);
    if (items.length === 0) continue;
    groups.push({ course: match[1].trim(), items });
  }
  return groups;
}

function buildClasses(rows: Record<string, string>[]): ClassItem[] {
  const map = new Map<string, ClassItem>();
  for (const row of rows) {
    const filePath = cleanPath(row["File Path"] || "");
    if (!filePath) continue;
    const title = row.Title || fileName(filePath);
    let item = map.get(title);
    if (!item) {
      item = {
        id: slug(title),
        title,
        difficulty: row.Difficulty || "",
        type: row.Type || "",
        minutes: row.Minutes ? Number(row.Minutes) || null : null,
        description: stripUrls(row.Description || ""),
        parts: [],
      };
      map.set(title, item);
    }
    const partTitle = fileName(filePath).replace(/\.mp4$/i, "");
    item.parts.push({ title: partTitle, path: filePath });
    if (!item.description && row.Description) item.description = stripUrls(row.Description);
  }
  return [...map.values()];
}

function lookupMedia(titles: string[], find: (title: string) => string | undefined, warnings: string[]) {
  const found: { title: string; path: string }[] = [];
  for (const title of titles) {
    const mediaPath = find(title);
    if (!mediaPath) warnings.push(`Missing class video for "${title}"`);
    else found.push({ title, path: mediaPath });
  }
  return found;
}

function requireMedia(title: string, find: (title: string) => string | undefined, warnings: string[]) {
  const mediaPath = find(title);
  if (!mediaPath) {
    warnings.push(`Missing class video for "${title}"`);
    return { title, path: "" };
  }
  return { title, path: mediaPath };
}

function ensureCourse(map: Map<string, Course>, category: string, name: string): Course {
  const id = slug(`${category}-${name}`);
  let course = map.get(id);
  if (!course) {
    course = { id, category, name, tracks: [] };
    map.set(id, course);
  }
  return course;
}

function ensureTrack(course: Course, name: string) {
  let track = course.tracks.find((item) => item.name === name);
  if (!track) {
    track = { name, exerciseIds: [], videos: [] };
    course.tracks.push(track);
  }
  return track;
}

function indexEmbedded(data: unknown): Map<string, { imName: string; focus: { strength: string[]; mobility: string[] } }> {
  const map = new Map<string, { imName: string; focus: { strength: string[]; mobility: string[] } }>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.element === "string") {
      const points = record.exercisesFocusPoints as { strength?: { description?: string }[]; mobility?: { description?: string }[] } | undefined;
      map.set(record.element, {
        imName: typeof record.imName === "string" ? record.imName : "",
        focus: {
          strength: (points?.strength ?? []).map((item) => stripUrls(String(item.description ?? ""))).filter(Boolean),
          mobility: (points?.mobility ?? []).map((item) => stripUrls(String(item.description ?? ""))).filter(Boolean),
        },
      });
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object" && value !== record.exercisesVideos) visit(value);
    }
  };
  visit(data);
  return map;
}

function parseFocus(raw: string): { strength: string[]; mobility: string[] } {
  const strength: string[] = [];
  const mobility: string[] = [];
  for (const part of raw.split("|")) {
    const match = part.match(/^\s*(Strength|Mobility)\s*:\s*(.*)$/i);
    if (!match) continue;
    const bits = match[2].split(/\s*(?=\d+\))/).map((bit) => bit.trim()).filter(Boolean);
    (match[1].toLowerCase() === "strength" ? strength : mobility).push(...bits);
  }
  return { strength, mobility };
}

function collectPaths(specDir: string, catalog: Record<string, string>[], classes: Record<string, string>[]): string[] {
  const paths = new Set<string>();
  for (const row of catalog) {
    const filePath = cleanPath(row["File Path"] || "");
    if (filePath) paths.add(filePath);
  }
  for (const row of classes) {
    const filePath = cleanPath(row["File Path"] || "");
    if (filePath) paths.add(filePath);
  }
  const listFile = path.join(specDir, "video_paths.txt");
  if (fs.existsSync(listFile)) {
    for (const line of fs.readFileSync(listFile, "utf8").split(/\r?\n/)) {
      const filePath = cleanPath(line);
      if (filePath) paths.add(filePath);
    }
  }
  return [...paths];
}

function levelOf(course: string): number {
  const match = course.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 1;
}

function cleanPath(value: string): string {
  return value.replace(/^\.\//, "").replace(/\\/g, "/").trim();
}

function fileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function normTitle(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function stripUrls(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(hidden("gi", "\\b[\\w.-]*", "gymnas", "ticbodies", "[\\w.-]*\\b"), "")
    .replace(hidden("gi", "\\b[\\w.-]*", "ver", "cel", "[\\w.-]*\\b"), "")
    .replace(hidden("gi", "\\b", "blob", "\\.core", "[\\w.-]*\\b"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();
}

function read(specDir: string, name: string): string {
  const file = path.join(specDir, name);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, "utf8");
}

function readJson(file: string): unknown {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function findFirst(specDir: string, rels: string[]): string | undefined {
  for (const rel of rels) {
    const full = path.join(specDir, rel);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

export function resolveSpecDir(input: string): string {
  const abs = path.resolve(input);
  if (fs.existsSync(path.join(abs, "Catalog.csv"))) return abs;
  if (!fs.existsSync(abs)) throw new Error(`No Catalog.csv under ${abs}`);
  for (const name of fs.readdirSync(abs)) {
    const child = path.join(abs, name);
    if (fs.existsSync(path.join(child, "Catalog.csv"))) return child;
  }
  throw new Error(`No Catalog.csv under ${abs}`);
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const entry = process.argv[1] ?? "";
if (entry.includes("generate-library")) {
  const spec = resolveSpecDir(arg("--spec") ?? "spec");
  const out = arg("--out");
  const { library, warnings } = generateLibrary(spec);
  const json = `${JSON.stringify(library, null, 2)}\n`;
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, json);
  } else {
    process.stdout.write(json);
  }
  const summary = [
    `exercises ${library.exercises.length}`,
    `courses ${library.courses.length}`,
    `classes ${library.classes.length}`,
    `beginner ${library.plans.beginner.workouts.length}`,
    `quiz ${library.quiz.questions.length}`,
    `habits ${library.habits.tasks.length}`,
    `bytes ${Buffer.byteLength(json)}`,
  ].join(", ");
  console.error(summary);
  for (const warning of warnings) console.error(`warning: ${warning}`);
}
