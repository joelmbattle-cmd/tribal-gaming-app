// Vector CAD / plot PDF → the same DxfScene the DXF importer produces, so a PDF
// floor plan flows through the identical guessLayers → extractPlan →
// layoutPlan → applyFloorPlanAction path (banks, BANK_TEXT labels, SEATS /
// SEAT_TEXT → Bank.seatSpots).
//
// AutoCAD / most CAD plotters write each CAD layer as a PDF optional-content
// group (OCG), so layer names like BANKS, SEATS, SEAT_TEXT, BANK_TEXT survive.
// We walk the page operator list ourselves (paths + text with the full CTM)
// instead of rasterising, tagging every path/text with its OCG layer. PDFs
// without layers fall back to one pseudo-layer per stroke colour so banks and
// seats drawn in different colours can still be told apart.
//
// Scanned / image-only PDFs have no paths and are rejected with a clear error.

import { buildScene, cleanDxfText } from "./dxf";
import type { DxfScene, RawPath, TextItem } from "./dxf";
import type { Pt } from "./geometry";

type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
const MAX_SEGMENTS = 400_000;
const CURVE_STEPS = 8;

// pdfjs DrawOPS codes inside constructPath buffers.
const D_MOVE = 0, D_LINE = 1, D_CURVE = 2, D_QUAD = 3, D_CLOSE = 4;

export const NO_PATHS_MESSAGE =
  "No vector line work was found in that PDF. It looks scanned or image-only — export a vector PDF (Plot/Publish to PDF from CAD with layers on) or upload the DXF instead.";

/** m ∘ n: apply n first, then m (PDF matrices are row vectors: n then m = n × m). */
function mul(n: Mat, m: Mat): Mat {
  return [
    n[0] * m[0] + n[1] * m[2],
    n[0] * m[1] + n[1] * m[3],
    n[2] * m[0] + n[3] * m[2],
    n[2] * m[1] + n[3] * m[3],
    n[4] * m[0] + n[5] * m[2] + m[4],
    n[4] * m[1] + n[5] * m[3] + m[5],
  ];
}
const ap = (m: Mat, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

type GState = { ctm: Mat; stroke: string; fill: string };
type MarkedLayer = string | null;

/** True when the bytes look like a PDF (header check, tolerant of leading junk). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfJs = any;

async function loadPdfJs(): Promise<PdfJs> {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

/** pdfjs passes matrices either flat (a,b,c,d,e,f) or wrapped ([matrix]); accept both. */
function asMat(a: unknown[]): Mat | null {
  const m = (a.length === 1 ? a[0] : a) as ArrayLike<number> | null;
  if (!m || m.length !== 6) return null;
  const out = Array.from(m) as Mat;
  return out.every(Number.isFinite) ? out : null;
}

function glyphText(glyphs: unknown): string {
  if (!Array.isArray(glyphs)) return "";
  let s = "";
  for (const g of glyphs) {
    if (g && typeof g === "object" && "unicode" in g) s += String((g as { unicode: string }).unicode ?? "");
    else if (typeof g === "number" && g < -200) s += " "; // large kerning gap ≈ space
  }
  return s;
}

export async function parsePdfScene(data: ArrayBuffer | Uint8Array, pdfjsOverride?: PdfJs): Promise<DxfScene> {
  const pdfjs = pdfjsOverride ?? (await loadPdfJs());
  const OPS = pdfjs.OPS;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!looksLikePdf(bytes)) throw new Error("That file isn't a readable PDF.");

  // pdfjs may transfer the buffer to its worker; hand it a copy.
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    throw new Error(/password/i.test(msg) ? "That PDF is password-protected — export an unlocked copy." : "That file isn't a readable PDF.");
  }
  try {
    const warnings: string[] = [];
    if (doc.numPages > 1) warnings.push(`PDF has ${doc.numPages} pages — only page 1 was read. Export the floor sheet on its own.`);
    const page = await doc.getPage(1);
    const ocConfig = await doc.getOptionalContentConfig().catch(() => null);
    const layerName = (props: unknown): string | null => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = props as any;
      const id = p?.id ?? (Array.isArray(p?.ids) ? p.ids[0] : null);
      if (id == null) return null;
      const name = ocConfig?.getGroup?.(id)?.name;
      return typeof name === "string" && name.trim() ? name.trim() : null;
    };

    const opList = await page.getOperatorList();
    const fns: number[] = opList.fnArray;
    const args: unknown[][] = opList.argsArray;

    const paths: RawPath[] = [];
    const texts: TextItem[] = [];
    let segments = 0;
    let sawOcg = false;
    let gs: GState = { ctm: IDENTITY, stroke: "#000000", fill: "#000000" };
    const stack: GState[] = [];
    const formStack: GState[] = [];
    const marked: MarkedLayer[] = [];
    // Text state
    let tm: Mat = IDENTITY;
    let tlm: Mat = IDENTITY;
    let leading = 0;

    const currentLayer = (fallback: string): string => {
      for (let i = marked.length - 1; i >= 0; i--) if (marked[i]) return marked[i]!;
      return fallback;
    };

    for (let i = 0; i < fns.length && segments <= MAX_SEGMENTS; i++) {
      const fn = fns[i];
      const a = args[i] ?? [];
      switch (fn) {
        case OPS.save: stack.push({ ...gs }); break;
        case OPS.restore: if (stack.length) gs = stack.pop()!; break;
        case OPS.transform: { const m = asMat(a); if (m) gs = { ...gs, ctm: mul(m, gs.ctm) }; break; }
        case OPS.paintFormXObjectBegin: {
          formStack.push({ ...gs });
          const m = a[0] ? asMat([a[0]]) : null;
          if (m) gs = { ...gs, ctm: mul(m, gs.ctm) };
          break;
        }
        case OPS.paintFormXObjectEnd: if (formStack.length) gs = formStack.pop()!; break;
        case OPS.setStrokeRGBColor: if (typeof a[0] === "string") gs = { ...gs, stroke: a[0] }; break;
        case OPS.setFillRGBColor: if (typeof a[0] === "string") gs = { ...gs, fill: a[0] }; break;
        case OPS.beginMarkedContent: marked.push(null); break;
        case OPS.beginMarkedContentProps: {
          const name = a[0] === "OC" ? layerName(a[1]) : null;
          if (name) sawOcg = true;
          marked.push(name);
          break;
        }
        case OPS.endMarkedContent: marked.pop(); break;
        case OPS.constructPath: {
          const paintOp = a[0] as number;
          const buf = (a[1] as unknown[] | undefined)?.[0];
          if (!(buf instanceof Float32Array) && !Array.isArray(buf)) break;
          if (paintOp === OPS.endPath) break; // clip-only path, not drawn
          const isFillOnly = paintOp === OPS.fill || paintOp === OPS.eoFill;
          const layer = currentLayer(`Colour ${isFillOnly ? gs.fill : gs.stroke}`);
          const d = buf as ArrayLike<number>;
          let cur: Pt[] = [];
          let last: Pt = [0, 0];
          const flush = (closed: boolean) => {
            if (cur.length >= 2) {
              const f = cur[0], l = cur[cur.length - 1];
              const shut = closed || (cur.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6);
              paths.push({ layer, handle: null, points: shut && cur.length > 2 && f[0] === l[0] && f[1] === l[1] ? cur.slice(0, -1) : cur, closed: shut });
              segments += cur.length;
            }
            cur = [];
          };
          for (let k = 0; k < d.length; ) {
            const op = d[k++];
            if (op === D_MOVE) {
              flush(false);
              last = [d[k++], d[k++]];
              cur.push(ap(gs.ctm, last[0], last[1]));
            } else if (op === D_LINE) {
              last = [d[k++], d[k++]];
              cur.push(ap(gs.ctm, last[0], last[1]));
            } else if (op === D_CURVE || op === D_QUAD) {
              const n = op === D_CURVE ? 3 : 2;
              const ctrl: Pt[] = [last];
              for (let j = 0; j < n; j++) ctrl.push([d[k++], d[k++]]);
              for (let s = 1; s <= CURVE_STEPS; s++) {
                const t = s / CURVE_STEPS, u = 1 - t;
                const p = n === 3
                  ? [u*u*u*ctrl[0][0] + 3*u*u*t*ctrl[1][0] + 3*u*t*t*ctrl[2][0] + t*t*t*ctrl[3][0],
                     u*u*u*ctrl[0][1] + 3*u*u*t*ctrl[1][1] + 3*u*t*t*ctrl[2][1] + t*t*t*ctrl[3][1]]
                  : [u*u*ctrl[0][0] + 2*u*t*ctrl[1][0] + t*t*ctrl[2][0],
                     u*u*ctrl[0][1] + 2*u*t*ctrl[1][1] + t*t*ctrl[2][1]];
                cur.push(ap(gs.ctm, p[0], p[1]));
              }
              last = ctrl[n];
            } else if (op === D_CLOSE) {
              flush(true);
            } else break; // unknown opcode — stop reading this buffer
          }
          flush(false);
          break;
        }
        // --- text ---
        case OPS.beginText: tm = IDENTITY; tlm = IDENTITY; break;
        case OPS.setTextMatrix: { const m = asMat(a); if (m) tm = tlm = m; break; }
        case OPS.setLeading: leading = Number(a[0]) || 0; break;
        case OPS.moveText: tm = tlm = mul([1, 0, 0, 1, Number(a[0]) || 0, Number(a[1]) || 0], tlm); break;
        case OPS.setLeadingMoveText:
          leading = -(Number(a[1]) || 0);
          tm = tlm = mul([1, 0, 0, 1, Number(a[0]) || 0, Number(a[1]) || 0], tlm);
          break;
        case OPS.nextLine: tm = tlm = mul([1, 0, 0, 1, 0, -leading], tlm); break;
        case OPS.showText:
        case OPS.showSpacedText:
        case OPS.nextLineShowText:
        case OPS.nextLineSetSpacingShowText: {
          if (fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) tm = tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
          const raw = glyphText(a[a.length - 1]);
          const value = cleanDxfText(raw);
          if (value) {
            const at = ap(mul(tm, gs.ctm), 0, 0);
            texts.push({ layer: currentLayer("Text"), at, value });
          }
          break;
        }
        default: break;
      }
    }

    if (!paths.length) throw new Error(NO_PATHS_MESSAGE);
    if (segments > MAX_SEGMENTS) warnings.push("Drawing is very large — geometry beyond the first 400k segments was ignored.");
    if (!sawOcg) {
      warnings.push(
        "This PDF has no CAD layers, so shapes are grouped by line colour. For reliable banks and seats, plot with layers (AutoCAD: “Include layer information”) or upload the DXF.",
      );
    }
    warnings.push("PDF coordinates are paper units (plot scale), not real-world units — bank proportions are preserved.");
    const scene = buildScene(paths, texts, warnings, null, NO_PATHS_MESSAGE);
    if (!scene.rings.length) throw new Error(NO_PATHS_MESSAGE);
    return scene;
  } finally {
    await Promise.resolve(task.destroy()).catch(() => undefined);
  }
}
