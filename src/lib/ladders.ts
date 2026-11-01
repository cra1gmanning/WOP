import type { Prescription } from "../types";

const STEP_SETS = [3, 5, 3, 4, 4, 5, 4, 4, 5];
const STEP_MULT = [1, 1, 2, 2, 3, 3, 4, 5, 5];

export function formatLabel(p: Omit<Prescription, "label">): string {
  if (p.unit === "custom") return p.customLabel || "";
  const unit = p.unit === "s" ? "s" : "r";
  let text = `${p.sets}x${p.amount}${unit}`;
  if (p.holdSeconds) text += `x${p.holdSeconds}s`;
  if (p.perSide) text += "@";
  if (p.suffix) text += p.suffix;
  return text;
}

function withLabel(p: Omit<Prescription, "label">): Prescription {
  return { ...p, label: formatLabel(p) };
}

/** Parse a mastery string such as 5x60s, 5x10r@, 5x5rx10s, or 5x5r + 10s. */
export function parseWork(raw: string): Prescription | null {
  const text = raw.trim();
  if (!text) return null;
  const match = text.match(/^(\d+)x(\d+)(r|s)(?:x(\d+)s)?(@)?(.*)$/);
  if (!match) {
    return withLabel({
      sets: 0,
      amount: 0,
      unit: "custom",
      perSide: false,
      customLabel: text,
    });
  }
  return withLabel({
    sets: Number(match[1]),
    amount: Number(match[2]),
    unit: match[3] === "s" ? "s" : "r",
    holdSeconds: match[4] ? Number(match[4]) : undefined,
    perSide: Boolean(match[5]),
    suffix: match[6] || undefined,
  });
}

/**
 * Nine-step ladder used by the guided plans.
 * Mastery is the last step, always shaped 5 x (5N): 3xN, 5xN, 3x2N, 4x2N, 4x3N, 5x3N, 4x4N, 4x5N, 5x5N.
 * A mastery that is not that shape is repeated for all nine steps.
 */
export function ladderFromMastery(mastery: string): Prescription[] {
  const parsed = parseWork(mastery);
  if (!parsed) return [];
  if (parsed.unit === "custom" || parsed.sets !== 5 || parsed.amount <= 0 || parsed.amount % 5 !== 0) {
    const step = parsed.unit === "custom" ? parsed : withLabel({ ...parsed, sets: parsed.sets });
    return Array.from({ length: 9 }, () => ({ ...step }));
  }
  const base = parsed.amount / 5;
  return STEP_MULT.map((mult, index) =>
    withLabel({
      sets: STEP_SETS[index],
      amount: base * mult,
      unit: parsed.unit,
      perSide: parsed.perSide,
      holdSeconds: parsed.holdSeconds,
      suffix: parsed.suffix,
    }),
  );
}

/** Mobility keeps its own work amount and uses the strength step's set count. */
export function mobilityForStep(mastery: string, strength: Prescription): Prescription {
  const parsed = parseWork(mastery);
  if (!parsed || parsed.unit === "custom") {
    const label = parsed?.label || mastery;
    return withLabel({
      sets: strength.sets,
      amount: 0,
      unit: "custom",
      perSide: false,
      customLabel: label,
    });
  }
  return withLabel({ ...parsed, sets: strength.sets });
}

export function setChoices(target: number, unit: Prescription["unit"]): number[] {
  if (unit === "custom") return [0, 1];
  const cap = Math.max(target + 5, Math.ceil(target * 1.5), target);
  const step = unit === "s" && target >= 20 ? 5 : 1;
  const values = new Set<number>([0, target]);
  for (let n = step; n <= cap; n += step) values.add(n);
  return [...values].sort((a, b) => a - b);
}
