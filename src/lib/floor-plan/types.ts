import { isFinitePt } from "./geometry";
import type { Pt } from "./geometry";

// Canvas-space limits. The map is pannable/zoomable, so a plan may be far
// larger than the demo floor, but never unbounded.
export const MIN_BANK_W = 200;
export const MIN_BANK_H = 120;
// Manual resizing may go below an imported card's minimum, but not so small
// the seat grid and header are unusable.
export const MANUAL_MIN_W = 160;
export const MANUAL_MIN_H = 90;
export const MAX_BANK_W = 1200;
export const MAX_BANK_H = 1200;
export const MAX_RING_POINTS = 400;
export const MAX_PLAN_BANKS = 1500;
export const MAX_OUTLINE_RINGS = 60;
export const MAX_PLAN_DIM = 20000;
export const DEFAULT_PLAN_WIDTH = 3200;
/** Padding between an imported plan's area band edge and the drawing. */
export const PLAN_PAD = 24;

export type PlanBankPayload = {
  /** Stable id within the plan (DXF handle, else lower-cased label) — lets a re-import update instead of duplicate. */
  ref: string;
  label: string;
  /** Card box in plan px, top-left origin (before the plan's own offset). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Exact footprint polygon, relative to the card's top-left. */
  footprint: Pt[];
};

export type PlanPayload = {
  name: string;
  sourceFile: string;
  units: string | null;
  scale: number;
  width: number;
  height: number;
  outline: Pt[][];
  banks: PlanBankPayload[];
  /** When set, updates that plan (matching banks by `ref`) instead of creating a new one. */
  targetPlanId?: string;
};

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function validRing(r: unknown): r is Pt[] {
  return Array.isArray(r) && r.length >= 3 && r.length <= MAX_RING_POINTS && r.every(isFinitePt);
}

/** Server-side gate: the client parsed the DXF, but never trust its numbers. */
export function validatePlanPayload(input: unknown): PlanPayload {
  const p = input as Partial<PlanPayload> | null;
  if (!p || typeof p !== "object") throw new Error("Invalid floor plan.");
  const name = String(p.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("Give the floor plan a name.");
  if (!isInt(p.width) || !isInt(p.height) || p.width < 100 || p.height < 100 || p.width > MAX_PLAN_DIM || p.height > MAX_PLAN_DIM) {
    throw new Error("Floor plan dimensions are out of range.");
  }
  if (!Array.isArray(p.outline) || p.outline.length < 1 || p.outline.length > MAX_OUTLINE_RINGS || !p.outline.every(validRing)) {
    throw new Error("Floor outline is invalid.");
  }
  if (!Array.isArray(p.banks) || p.banks.length < 1 || p.banks.length > MAX_PLAN_BANKS) {
    throw new Error(`A floor plan needs between 1 and ${MAX_PLAN_BANKS} banks.`);
  }
  const seen = new Set<string>();
  const banks: PlanBankPayload[] = p.banks.map((b) => {
    const ref = String(b?.ref ?? "").slice(0, 120);
    const label = String(b?.label ?? "").trim().slice(0, 120);
    if (!ref || !label) throw new Error("Every bank needs a name.");
    if (seen.has(ref)) throw new Error(`Duplicate bank reference "${ref}".`);
    seen.add(ref);
    const ok = [b.x, b.y, b.w, b.h].every(isInt) && b.w >= 40 && b.h >= 40 && b.w <= MAX_BANK_W && b.h <= MAX_BANK_H &&
      b.x >= 0 && b.y >= 0 && b.x <= MAX_PLAN_DIM && b.y <= MAX_PLAN_DIM;
    if (!ok) throw new Error(`Bank "${label}" has an invalid position or size.`);
    if (!validRing(b.footprint)) throw new Error(`Bank "${label}" has an invalid footprint.`);
    return { ref, label, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), footprint: b.footprint };
  });
  return {
    name,
    sourceFile: String(p.sourceFile ?? "").slice(0, 200),
    units: p.units ? String(p.units).slice(0, 30) : null,
    scale: isInt(p.scale) && p.scale > 0 ? p.scale : 1,
    width: Math.round(p.width),
    height: Math.round(p.height),
    outline: p.outline,
    banks,
    targetPlanId: p.targetPlanId ? String(p.targetPlanId) : undefined,
  };
}
