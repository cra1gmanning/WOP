#!/usr/bin/env node
/**
 * Denylist for a public repository.
 * Patterns are assembled from pieces so this file does not contain the blocked
 * phrases as continuous text. A hit exits non-zero.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function re(flags, ...parts) {
  return new RegExp(parts.join(""), flags);
}

const TEXT_RULES = [
  { id: "brand-name", re: re("i", "gymnas", "tic\\s*bod", "ies") },
  { id: "brand-domain", re: re("i", "gymnas", "ticbodies") },
  { id: "brand-token", re: re("i", "(^|[^a-z0-9])", "g", "b", "([^a-z0-9]|$)") },
  { id: "coach", re: re("i", "\\b", "som", "mer", "\\b") },
  { id: "course-a", re: re("i", "\\b", "found", "ation", "\\b") },
  { id: "course-b", re: re("i", "\\b", "thr", "ive", "\\b") },
  { id: "host-a", re: re("i", "thin", "kific") },
  { id: "host-b", re: re("i", "kaj", "abi") },
  { id: "host-c", re: re("i", "ver", "cel", "-storage") },
  { id: "origin-a", re: re("i", "scrap", "ed") },
  { id: "origin-b", re: re("i", "download", "ed from") },
  { id: "origin-c", re: re("i", "export", "ed from") },
  { id: "person", re: re("i", "\\b", "cra", "ig", "\\b") },
  { id: "place-a", re: re("i", "\\b", "mara", "na", "\\b") },
  { id: "place-b", re: re("i", "\\b", "arizo", "na", "\\b") },
  { id: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { id: "phone", re: /(?:\+?1[\s.-])?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/ },
  { id: "street", re: /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,3}\s+(?:street|avenue|road|drive|lane|boulevard|court)\b/i },
  { id: "win-user", re: re("i", "[A-Za-z]:\\\\", "Users", "\\\\") },
  { id: "win-cloud", re: re("i", "[A-Za-z]:\\\\", "One", "Drive") },
];

const ALLOWED_IDS = new Set(["638122c1-2c40-4c67-9f69-f425406cfce4"]);
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const MEDIA_EXT = new Set([".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v", ".mp3", ".wav", ".flac"]);
const TEXT_EXT = new Set([
  "", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml",
  ".html", ".css", ".py", ".txt", ".svg", ".gitignore", ".lock",
]);

const CONTACT_IDS = new Set(["email", "phone", "street"]);

export function scanText(text, file = "<memory>", { contact = true } = {}) {
  const hits = [];
  for (const rule of TEXT_RULES) {
    if (!contact && CONTACT_IDS.has(rule.id)) continue;
    rule.re.lastIndex = 0;
    if (rule.re.test(text)) hits.push(`${file}: ${rule.id}`);
  }
  if (contact) {
    for (const match of text.matchAll(GUID)) {
      if (!ALLOWED_IDS.has(match[0].toLowerCase())) hits.push(`${file}: unexpected-id ${match[0]}`);
    }
  }
  return hits;
}

function listFiles() {
  try {
    const raw = execSync("git ls-files -co --exclude-standard -z", { encoding: "buffer" });
    return raw.toString("utf8").split("\0").filter(Boolean);
  } catch {
    return [];
  }
}

function scanFile(file) {
  const ext = path.extname(file).toLowerCase();
  const hits = [];
  if (MEDIA_EXT.has(ext)) hits.push(`${file}: media-file`);
  let size = 0;
  try {
    size = fs.statSync(file).size;
  } catch {
    return hits;
  }
  if (size > 1_000_000 && [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
    hits.push(`${file}: large-image`);
  }
  const name = path.basename(file);
  const contact = path.basename(file) !== "package-lock.json";
  if (TEXT_EXT.has(ext) || !ext) {
    hits.push(...scanText(file, `${file} (path)`, { contact }));
    if (size < 5_000_000) hits.push(...scanText(fs.readFileSync(file, "utf8"), file, { contact }));
  } else {
    hits.push(...scanText(name, `${file} (name)`, { contact }));
  }
  return hits;
}

function selfTest() {
  const samples = [
    [" ", "g", "b", " plan"],
    ["gymnas", "tic bodies"],
    ["gymnas", "ticbodies.com"],
    [" coach ", "Som", "mer "],
    ["found", "ation course"],
    ["Thr", "ive lessons"],
    ["thin", "kific"],
    ["kaj", "abi"],
    ["ver", "cel-storage"],
    ["scrap", "ed the site"],
    ["download", "ed from the web"],
    ["export", "ed from the app"],
    ["hello ", "Cra", "ig"],
    ["Mara", "na"],
    ["Arizo", "na"],
    ["person", "@", "example.com"],
    ["555", "-010-", "0199"],
    ["12 Oak ", "Street"],
    ["C:\\", "Users", "\\someone"],
    ["D:\\", "One", "Drive"],
    ["aaaaaaaa", "-bbbb-cccc-dddd-", "eeeeeeeeeeee"],
  ];
  const failures = [];
  for (const parts of samples) {
    const text = parts.join("");
    if (scanText(text).length === 0) failures.push(`missed ${parts.join("|")}`);
  }
  if (scanText("Push-up, squat, and a mobility drill in /Workouts.").length !== 0) {
    failures.push("flagged a clean sentence");
  }
  if (scanText("client 638122c1-2c40-4c67-9f69-f425406cfce4").length !== 0) {
    failures.push("flagged the public client id");
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("denylist self-test ok");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const hits = [];
  for (const file of listFiles()) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    hits.push(...scanFile(file));
  }
  if (hits.length) {
    console.error(hits.join("\n"));
    process.exit(1);
  }
  console.log("public scan ok");
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("check-public.mjs")) main();
