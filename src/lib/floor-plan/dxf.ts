// Deterministic DXF → floor-plan extraction. `dxf-parser` does the tokenising;
// everything after that (block expansion, arc tessellation, ring chaining,
// bank/label detection, canvas layout) is plain geometry with no heuristics
// that depend on ordering luck.
//
// v1 scope: 2D model-space geometry — LINE, LWPOLYLINE, POLYLINE (bulges
// included), ARC, CIRCLE, TEXT, MTEXT and INSERT (nested blocks, rotation,
// non-uniform / negative scale, row/column arrays). Splines, ellipses, hatches
// and 3D entities are skipped and reported as warnings.
//
// DWG is a proprietary binary format with no deterministic open parser; users
// export DXF from AutoCAD (SAVEAS → "AutoCAD DXF") instead.

import DxfParser from "dxf-parser";
import type { IDxf, IEntity } from "dxf-parser";
import {
  arcPoints,
  boundsOf,
  bulgeArc,
  chainPaths,
  cleanRing,
  emptyBounds,
  extendBounds,
  polygonArea,
  polygonCentroid,
  polygonInsidePolygon,
  pointInPolygon,
  simplifyToMax,
} from "./geometry";
import type { Bounds, Pt } from "./geometry";
import { MAX_RING_POINTS, MIN_BANK_H, MIN_BANK_W } from "./types";
import type { PlanBankPayload, PlanPayload } from "./types";

export type Shape = { layer: string; handle: string | null; points: Pt[] };
export type TextItem = { layer: string; at: Pt; value: string };
export type LayerInfo = { name: string; rings: number; openPaths: number; texts: number };
export type DxfScene = {
  units: string | null;
  layers: LayerInfo[];
  rings: Shape[];
  texts: TextItem[];
  warnings: string[];
  bounds: Bounds;
};

// Affine 2D: x' = a·x + c·y + e, y' = b·x + d·y + f
type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
const MAX_DEPTH = 6;
const MAX_ARRAY_CELLS = 2000;
const MAX_SEGMENTS = 400_000;

const INSUNITS: Record<number, string> = {
  1: "inches", 2: "feet", 3: "miles", 4: "millimeters", 5: "centimeters", 6: "meters", 7: "kilometers",
  8: "microinches", 9: "mils", 10: "yards",
};

function mul(m: Mat, n: Mat): Mat {
  // m ∘ n (apply n first, then m)
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Mat, x: number, y: number): Pt {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** MTEXT/TEXT formatting codes → plain single-line text. */
export function cleanDxfText(raw: string): string {
  return raw
    .replace(/\\[Pp]/g, " ")
    .replace(/\\[A-Za-z][^;\\]*;/g, "") // \fArial|b0;  \H2.5;  \C1;
    .replace(/\\~/g, " ")
    .replace(/%%[cC]/g, "⌀")
    .replace(/%%[dD]/g, "°")
    .replace(/%%[pP]/g, "±")
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Collector = {
  paths: { layer: string; handle: string | null; points: Pt[]; closed: boolean }[];
  texts: TextItem[];
  skipped: Map<string, number>;
  segments: number;
};

function skip(c: Collector, what: string) {
  c.skipped.set(what, (c.skipped.get(what) ?? 0) + 1);
}

function collect(
  entities: IEntity[],
  blocks: IDxf["blocks"],
  m: Mat,
  parentLayer: string | null,
  depth: number,
  c: Collector,
) {
  for (const raw of entities) {
    if (c.segments > MAX_SEGMENTS) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = raw as any;
    if (e.inPaperSpace || e.visible === false) continue;
    // Entities on layer "0" inside a block take the layer of the INSERT.
    const layer: string = e.layer === "0" && parentLayer ? parentLayer : (e.layer ?? "0");
    const handle = e.handle != null && depth === 0 ? String(e.handle) : null;

    switch (e.type) {
      case "LINE": {
        const v = e.vertices as { x: number; y: number }[] | undefined;
        if (v && v.length >= 2) {
          c.paths.push({ layer, handle, points: [apply(m, v[0].x, v[0].y), apply(m, v[1].x, v[1].y)], closed: false });
          c.segments++;
        }
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE": {
        if (e.type === "POLYLINE" && (e.is3dPolygonMesh || e.isPolyfaceMesh)) {
          skip(c, "3D mesh");
          break;
        }
        const verts = ((e.vertices ?? []) as { x: number; y: number; bulge?: number }[]).filter(
          (v) => Number.isFinite(v.x) && Number.isFinite(v.y),
        );
        if (verts.length < 2) break;
        const closed = !!e.shape;
        const local: Pt[] = [];
        const n = verts.length;
        const segCount = closed ? n : n - 1;
        for (let i = 0; i < segCount; i++) {
          const a: Pt = [verts[i].x, verts[i].y];
          const b: Pt = [verts[(i + 1) % n].x, verts[(i + 1) % n].y];
          local.push(...bulgeArc(a, b, verts[i].bulge ?? 0));
        }
        if (!closed) local.push([verts[n - 1].x, verts[n - 1].y]);
        c.paths.push({ layer, handle, points: local.map((p) => apply(m, p[0], p[1])), closed });
        c.segments += local.length;
        break;
      }
      case "ARC": {
        if (!e.center || !(e.radius > 0)) break;
        const pts = arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle);
        c.paths.push({ layer, handle, points: pts.map((p) => apply(m, p[0], p[1])), closed: false });
        c.segments += pts.length;
        break;
      }
      case "CIRCLE": {
        if (!e.center || !(e.radius > 0)) break;
        const pts = arcPoints(e.center.x, e.center.y, e.radius, 0, Math.PI * 2, Math.PI / 16).slice(0, -1);
        c.paths.push({ layer, handle, points: pts.map((p) => apply(m, p[0], p[1])), closed: true });
        c.segments += pts.length;
        break;
      }
      case "TEXT": {
        const p = e.startPoint;
        const value = cleanDxfText(String(e.text ?? ""));
        if (p && value) c.texts.push({ layer, at: apply(m, p.x, p.y), value });
        break;
      }
      case "MTEXT": {
        const p = e.position;
        const value = cleanDxfText(String(e.text ?? ""));
        if (p && value) c.texts.push({ layer, at: apply(m, p.x, p.y), value });
        break;
      }
      case "INSERT": {
        const block = blocks?.[e.name];
        if (!block?.entities || !e.position) break;
        if (depth >= MAX_DEPTH) {
          skip(c, "over-nested block");
          break;
        }
        const sx = Number.isFinite(e.xScale) && e.xScale !== 0 ? e.xScale : 1;
        const sy = Number.isFinite(e.yScale) && e.yScale !== 0 ? e.yScale : 1;
        const rot = ((Number.isFinite(e.rotation) ? e.rotation : 0) * Math.PI) / 180;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const base = block.position ?? { x: 0, y: 0 };
        const cols = Math.min(Math.max(1, e.columnCount || 1), 200);
        const rows = Math.min(Math.max(1, e.rowCount || 1), 200);
        if (cols * rows > MAX_ARRAY_CELLS) {
          skip(c, "oversized INSERT array");
          break;
        }
        for (let r = 0; r < rows; r++) {
          for (let cc = 0; cc < cols; cc++) {
            const ox = cc * (e.columnSpacing || 0);
            const oy = r * (e.rowSpacing || 0);
            // world = T(pos) · R(rot) · [S · (p − base) + array offset]
            const local: Mat = [sx, 0, 0, sy, -sx * base.x + ox, -sy * base.y + oy];
            const rotM: Mat = [cos, sin, -sin, cos, e.position.x, e.position.y];
            collect(block.entities, blocks, mul(m, mul(rotM, local)), layer, depth + 1, c);
          }
        }
        break;
      }
      case "SPLINE":
      case "ELLIPSE":
      case "SOLID":
      case "3DFACE":
        skip(c, e.type.toLowerCase());
        break;
      default:
        break;
    }
  }
}

export function parseDxfScene(text: string): DxfScene {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text);
  if (!dxf) throw new Error("That file isn't a readable DXF.");

  const c: Collector = { paths: [], texts: [], skipped: new Map(), segments: 0 };
  collect(dxf.entities ?? [], dxf.blocks ?? {}, IDENTITY, null, 0, c);

  const warnings: string[] = [];
  for (const [what, n] of c.skipped) warnings.push(`Skipped ${n} unsupported ${what} entit${n === 1 ? "y" : "ies"}.`);
  if (c.segments > MAX_SEGMENTS) warnings.push("Drawing is very large — geometry beyond the first 400k segments was ignored.");

  // Extent-relative tolerance for joining line work drawn as separate segments.
  const all = emptyBounds();
  for (const p of c.paths) for (const pt of p.points) extendBounds(all, pt);
  const extent = Math.max(all.maxX - all.minX, all.maxY - all.minY);
  if (!Number.isFinite(extent) || extent <= 0) throw new Error("No usable geometry was found in that DXF.");
  const tol = extent * 1e-5;

  // Closed polylines/circles are rings already; open paths are chained per layer.
  const rings: Shape[] = [];
  const openByLayer = new Map<string, Pt[][]>();
  for (const p of c.paths) {
    if (p.closed) {
      const ring = cleanRing(p.points);
      if (ring.length >= 3 && Math.abs(polygonArea(ring)) > tol * tol) rings.push({ layer: p.layer, handle: p.handle, points: ring });
    } else {
      const list = openByLayer.get(p.layer);
      if (list) list.push(p.points);
      else openByLayer.set(p.layer, [p.points]);
    }
  }
  const openCount = new Map<string, number>();
  for (const [layer, paths] of openByLayer) {
    const { rings: chained, open } = chainPaths(paths, tol);
    for (const ring of chained) {
      if (ring.length >= 3 && Math.abs(polygonArea(ring)) > tol * tol) rings.push({ layer, handle: null, points: ring });
    }
    openCount.set(layer, open.length);
  }

  const layerMap = new Map<string, LayerInfo>();
  const info = (name: string) => {
    let l = layerMap.get(name);
    if (!l) layerMap.set(name, (l = { name, rings: 0, openPaths: 0, texts: 0 }));
    return l;
  };
  for (const r of rings) info(r.layer).rings++;
  for (const [layer, n] of openCount) info(layer).openPaths = n;
  for (const t of c.texts) info(t.layer).texts++;

  const bounds = emptyBounds();
  for (const r of rings) for (const p of r.points) extendBounds(bounds, p);

  const unitCode = dxf.header?.["$INSUNITS"];
  return {
    units: typeof unitCode === "number" ? (INSUNITS[unitCode] ?? null) : null,
    layers: [...layerMap.values()].sort((a, b) => b.rings - a.rings || a.name.localeCompare(b.name)),
    rings,
    texts: c.texts,
    warnings,
    bounds,
  };
}

// ---------------------------------------------------------------------------
// Layer guessing + plan extraction
// ---------------------------------------------------------------------------

const OUTLINE_HINT = /outline|boundary|perimeter|wall|floor|footprint|envelope|casino|gaming[-_ ]?area/i;
const BANK_HINT = /bank|slot|egm|machine|gaming|island|carousel/i;

export function guessLayers(scene: DxfScene): { outlineLayers: string[]; bankLayers: string[] } {
  const withRings = scene.layers.filter((l) => l.rings > 0);
  const banks = withRings.filter((l) => BANK_HINT.test(l.name)).map((l) => l.name);
  const outline = withRings.filter((l) => OUTLINE_HINT.test(l.name) && !banks.includes(l.name)).map((l) => l.name);
  return { outlineLayers: outline, bankLayers: banks };
}

export type PlanOptions = {
  outlineLayers: string[];
  bankLayers: string[];
  /** Total plan width in canvas px (height follows the drawing's aspect ratio). */
  targetWidth: number;
};

export type ExtractedPlan = {
  outline: Pt[][]; // drawing units, y-up
  banks: { ref: string; label: string; points: Pt[] }[];
  bounds: Bounds;
  warnings: string[];
};

function displayLabel(raw: string): string {
  const t = raw.trim();
  // A bare tag like "104" or "A7" reads better — and matches Excel bank
  // columns better — as "Bank 104".
  return /^[A-Za-z]?\d+[A-Za-z]?$/.test(t) ? `Bank ${t}` : t;
}

function pickLabel(ring: Pt[], texts: TextItem[]): string | null {
  const inside = texts.filter((t) => pointInPolygon(t.at, ring));
  if (!inside.length) return null;
  // Reading order: top-to-bottom, then left-to-right; prefer a tag containing a digit.
  inside.sort((a, b) => b.at[1] - a.at[1] || a.at[0] - b.at[0]);
  return (inside.find((t) => /\d/.test(t.value)) ?? inside[0]).value;
}

export function extractPlan(scene: DxfScene, opts: Pick<PlanOptions, "outlineLayers" | "bankLayers">): ExtractedPlan {
  const warnings: string[] = [];
  const outlineSet = new Set(opts.outlineLayers);
  const bankSet = new Set(opts.bankLayers);

  const bankRings = scene.rings.filter((r) => bankSet.has(r.layer));
  if (!bankRings.length) throw new Error("No closed bank shapes found on the selected bank layer(s).");

  // Outline: the selected layers' rings. Largest is the perimeter; the rest are
  // courtyards/pillars/other lobes and are rendered even-odd. Without an outline
  // layer, fall back to the drawing's bounding box so the map still has a floor.
  let outline: Pt[][] = scene.rings.filter((r) => outlineSet.has(r.layer) && !bankSet.has(r.layer)).map((r) => r.points);
  const allBounds = emptyBounds();
  for (const r of bankRings) for (const p of r.points) extendBounds(allBounds, p);
  for (const o of outline) for (const p of o) extendBounds(allBounds, p);
  if (!outline.length) {
    const padX = (allBounds.maxX - allBounds.minX) * 0.03 || 1;
    const padY = (allBounds.maxY - allBounds.minY) * 0.03 || 1;
    outline = [[
      [allBounds.minX - padX, allBounds.minY - padY],
      [allBounds.maxX + padX, allBounds.minY - padY],
      [allBounds.maxX + padX, allBounds.maxY + padY],
      [allBounds.minX - padX, allBounds.maxY + padY],
    ]];
    warnings.push("No floor-outline layer selected — using the bounding box of the banks as the floor.");
  }

  // Bank footprints: keep only outermost shapes (a bank block that also draws
  // one box per machine yields a single bank, not N), and drop anything as big
  // as the floor itself.
  const perimeterArea = Math.max(...outline.map((o) => Math.abs(polygonArea(o))));
  const candidates = bankRings
    .map((r) => ({ ...r, area: Math.abs(polygonArea(r.points)), bounds: boundsOf(r.points) }))
    .filter((r) => r.area < perimeterArea * 0.5)
    .sort((a, b) => b.area - a.area);
  const kept: typeof candidates = [];
  for (const cand of candidates) {
    const nested = kept.some(
      (k) =>
        cand.bounds.minX >= k.bounds.minX && cand.bounds.maxX <= k.bounds.maxX &&
        cand.bounds.minY >= k.bounds.minY && cand.bounds.maxY <= k.bounds.maxY &&
        polygonInsidePolygon(cand.points, k.points),
    );
    if (!nested) kept.push(cand);
  }
  if (kept.length < candidates.length) {
    warnings.push(`Ignored ${candidates.length - kept.length} shape(s) nested inside a larger bank footprint.`);
  }

  // Reading order (rows top→bottom, ~one bank-height tolerance) makes fallback
  // names and duplicate suffixes stable between runs.
  const heights = kept.map((k) => k.bounds.maxY - k.bounds.minY).sort((a, b) => a - b);
  const rowTol = (heights[Math.floor(heights.length / 2)] ?? 1) / 2;
  kept.sort((a, b) => {
    const ay = polygonCentroid(a.points)[1];
    const by = polygonCentroid(b.points)[1];
    if (Math.abs(ay - by) > rowTol) return by - ay;
    return polygonCentroid(a.points)[0] - polygonCentroid(b.points)[0];
  });

  const used = new Set<string>();
  let unlabeled = 0;
  const banks: ExtractedPlan["banks"] = kept.map((k) => {
    const found = pickLabel(k.points, scene.texts);
    let label = found ? displayLabel(found) : `Bank ${++unlabeled}`;
    const base = label;
    for (let n = 2; used.has(label.toLowerCase()); n++) label = `${base} (${n})`;
    used.add(label.toLowerCase());
    return { ref: k.handle ? `h:${k.handle}` : `l:${label.toLowerCase()}`, label, points: k.points };
  });
  if (unlabeled) warnings.push(`${unlabeled} bank(s) had no text label inside them and were named "Bank N" — rename in Edit Layout or match by column in the Excel step.`);

  return { outline, banks, bounds: allBounds, warnings };
}

/**
 * Scales drawing units to canvas px (uniform — proportions are preserved),
 * flips Y (DXF is y-up), and sizes each bank's card to its footprint's bounding
 * box, growing it to the minimum needed to show its seats readably. Footprints
 * are kept as exact polygons (relative to the card's top-left) so the vector
 * shape stays true even when the card is larger.
 */
export function layoutPlan(
  extracted: ExtractedPlan,
  targetWidth: number,
  minBank = { w: MIN_BANK_W, h: MIN_BANK_H },
): { plan: Omit<PlanPayload, "name" | "sourceFile" | "units" | "targetPlanId">; warnings: string[] } {
  const warnings: string[] = [];
  const b = extracted.bounds;
  const spanX = b.maxX - b.minX || 1;
  const scale = targetWidth / spanX;
  const width = Math.round(spanX * scale);
  const height = Math.round((b.maxY - b.minY) * scale);
  const toPx = (p: Pt): Pt => [(p[0] - b.minX) * scale, (b.maxY - p[1]) * scale];
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const outline = extracted.outline.map((ring) => simplifyToMax(ring.map(toPx), 0.4, MAX_RING_POINTS).map((p): Pt => [r1(p[0]), r1(p[1])]));

  let tooSmall = 0;
  const banks: PlanBankPayload[] = extracted.banks.map((bank) => {
    const px = simplifyToMax(bank.points.map(toPx), 0.3, MAX_RING_POINTS);
    const pb = boundsOf(px);
    const fw = pb.maxX - pb.minX;
    const fh = pb.maxY - pb.minY;
    const w = Math.max(Math.round(fw), minBank.w);
    const h = Math.max(Math.round(fh), minBank.h);
    if (fw < minBank.w || fh < minBank.h) tooSmall++;
    // Card centred on the footprint; footprint stored relative to card origin.
    const x = Math.round(pb.minX - (w - fw) / 2);
    const y = Math.round(pb.minY - (h - fh) / 2);
    return {
      ref: bank.ref,
      label: bank.label,
      x,
      y,
      w,
      h,
      footprint: px.map((p): Pt => [r1(p[0] - x), r1(p[1] - y)]),
    };
  });
  if (tooSmall) {
    warnings.push(
      `${tooSmall} bank(s) are smaller than a readable seat grid at this scale, so their cards are drawn at a minimum size (footprints stay exact). Increase the plan width or use Edit Layout → resize.`,
    );
  }

  // Cards can poke slightly outside the outline; keep them on the canvas.
  const minX = Math.min(0, ...banks.map((k) => k.x));
  const minY = Math.min(0, ...banks.map((k) => k.y));
  if (minX < 0 || minY < 0) {
    for (const k of banks) {
      k.x -= minX;
      k.y -= minY;
    }
    for (const ring of outline) for (const p of ring) { p[0] = r1(p[0] - minX); p[1] = r1(p[1] - minY); }
  }
  const fullW = Math.max(width - minX, ...banks.map((k) => k.x + k.w));
  const fullH = Math.max(height - minY, ...banks.map((k) => k.y + k.h));

  return { plan: { scale, width: Math.round(fullW), height: Math.round(fullH), outline, banks }, warnings };
}
