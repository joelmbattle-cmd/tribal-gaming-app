// Pure 2D helpers for the CAD floor-plan import. No DOM, no Node APIs — runs in
// the browser (DXF parsing) and on the server (payload validation).

export type Pt = [number, number];
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function extendBounds(b: Bounds, p: Pt) {
  if (p[0] < b.minX) b.minX = p[0];
  if (p[1] < b.minY) b.minY = p[1];
  if (p[0] > b.maxX) b.maxX = p[0];
  if (p[1] > b.maxY) b.maxY = p[1];
}

export function boundsOf(points: Pt[]): Bounds {
  const b = emptyBounds();
  for (const p of points) extendBounds(b, p);
  return b;
}

export function isFinitePt(p: unknown): p is Pt {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/** Signed shoelace area; the absolute value is the polygon's area. */
export function polygonArea(points: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function polygonCentroid(points: Pt[]): Pt {
  const area = polygonArea(points);
  if (Math.abs(area) < 1e-12) {
    const b = boundsOf(points);
    return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

/** Even-odd ray cast. */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonInsidePolygon(inner: Pt[], outer: Pt[]): boolean {
  return inner.every((p) => pointInPolygon(p, outer));
}

/** Points along a DXF bulge segment (bulge = tan(sweep / 4)); excludes the end point. */
export function bulgeArc(a: Pt, b: Pt, bulge: number, maxSegAngle = Math.PI / 12): Pt[] {
  if (!bulge || !Number.isFinite(bulge)) return [a];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return [a];
  const sweep = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(sweep) / 2));
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const h = Math.sqrt(Math.max(0, radius * radius - (chord / 2) ** 2));
  // Centre sits to the left of a→b for a CCW arc (bulge > 0), right for CW.
  const side = bulge > 0 ? 1 : -1;
  const sign = Math.abs(sweep) > Math.PI ? -1 : 1;
  const cx = mx - (dy / chord) * h * side * sign;
  const cy = my + (dx / chord) * h * side * sign;
  const start = Math.atan2(a[1] - cy, a[0] - cx);
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / maxSegAngle));
  const out: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = start + (sweep * i) / steps;
    out.push([cx + radius * Math.cos(t), cy + radius * Math.sin(t)]);
  }
  out[0] = a;
  return out;
}

/** Arc/circle points from `start` sweeping CCW to `end` (radians), inclusive of both ends. */
export function arcPoints(cx: number, cy: number, r: number, start: number, end: number, maxSegAngle = Math.PI / 12): Pt[] {
  let sweep = end - start;
  while (sweep <= 0) sweep += Math.PI * 2;
  const steps = Math.max(2, Math.ceil(sweep / maxSegAngle));
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (sweep * i) / steps;
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

/** Ramer–Douglas–Peucker for a closed ring; keeps the first vertex. */
export function simplifyRing(points: Pt[], tolerance: number): Pt[] {
  if (points.length <= 4) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = points[s];
    const [bx, by] = points[e];
    const len = Math.hypot(bx - ax, by - ay);
    for (let i = s + 1; i < e; i++) {
      const [px, py] = points[i];
      const d = len < 1e-12 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tolerance) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = points.filter((_, i) => keep[i]);
  return out.length >= 3 ? out : points;
}

/** Simplifies with a growing tolerance until the ring fits `max` vertices (never truncates). */
export function simplifyToMax(points: Pt[], tolerance: number, max: number): Pt[] {
  let tol = tolerance;
  let out = simplifyRing(points, tol);
  while (out.length > max && tol < 1e6) {
    tol *= 2;
    out = simplifyRing(points, tol);
  }
  return out;
}

/** Drops a repeated closing vertex and consecutive duplicates. */
export function cleanRing(points: Pt[], eps = 1e-9): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > eps || Math.abs(last[1] - p[1]) > eps) out.push(p);
  }
  if (out.length > 1) {
    const f = out[0];
    const l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) <= eps && Math.abs(f[1] - l[1]) <= eps) out.pop();
  }
  return out;
}

/**
 * Joins open paths whose end points meet (within `tol`) into closed rings.
 * Deterministic: paths are consumed in input order, always extending the ring
 * from its tail. Paths that never close are returned in `open`.
 */
export function chainPaths(paths: Pt[][], tol: number): { rings: Pt[][]; open: Pt[][] } {
  const key = (p: Pt) => `${Math.round(p[0] / tol)},${Math.round(p[1] / tol)}`;
  const near = (p: Pt) => {
    const cx = Math.round(p[0] / tol);
    const cy = Math.round(p[1] / tol);
    const keys: string[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keys.push(`${cx + dx},${cy + dy}`);
    return keys;
  };
  const close = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;

  const used = new Array<boolean>(paths.length).fill(false);
  // Endpoint index: cell → [pathIndex, atStart]
  const index = new Map<string, [number, boolean][]>();
  paths.forEach((path, i) => {
    if (path.length < 2) return;
    for (const [pt, atStart] of [[path[0], true], [path[path.length - 1], false]] as [Pt, boolean][]) {
      const k = key(pt);
      const list = index.get(k);
      if (list) list.push([i, atStart]);
      else index.set(k, [[i, atStart]]);
    }
  });

  const rings: Pt[][] = [];
  const open: Pt[][] = [];
  for (let i = 0; i < paths.length; i++) {
    if (used[i] || paths[i].length < 2) continue;
    used[i] = true;
    const chain: Pt[] = [...paths[i]];
    let extended = true;
    while (extended) {
      extended = false;
      if (chain.length > 2 && close(chain[0], chain[chain.length - 1])) break;
      const tail = chain[chain.length - 1];
      for (const k of near(tail)) {
        const candidates = index.get(k);
        if (!candidates) continue;
        const hit = candidates.find(([pi, atStart]) => {
          if (used[pi]) return false;
          const p = paths[pi];
          return close(tail, atStart ? p[0] : p[p.length - 1]);
        });
        if (hit) {
          const [pi, atStart] = hit;
          used[pi] = true;
          const seg = atStart ? paths[pi] : [...paths[pi]].reverse();
          chain.push(...seg.slice(1));
          extended = true;
          break;
        }
      }
    }
    if (chain.length > 3 && close(chain[0], chain[chain.length - 1])) rings.push(cleanRing(chain));
    else open.push(chain);
  }
  return { rings, open };
}
