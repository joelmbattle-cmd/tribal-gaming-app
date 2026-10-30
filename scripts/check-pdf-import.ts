// Runs a PDF through the Floor Setup CAD pipeline (no DB) and prints banks + seats.
// Usage: npx tsx scripts/check-pdf-import.ts file.pdf
import { readFileSync } from "node:fs";
import { extractPlan, guessLayers, layoutPlan } from "../src/lib/floor-plan/dxf";
import { parsePdfScene } from "../src/lib/floor-plan/pdf";

async function main() {
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const scene = await parsePdfScene(new Uint8Array(readFileSync(process.argv[2])), pdfjs);
const guess = guessLayers(scene);
console.log("layers", scene.layers, "guess", guess);
const ex = extractPlan(scene, guess);
const laid = layoutPlan(ex, 3200);
for (const b of laid.plan.banks) console.log(b.label, b.w, b.h, "seats:", b.seats?.filter(Boolean).length, JSON.stringify(b.seats));
console.log("warnings", [...scene.warnings, ...ex.warnings, ...laid.warnings]);
}
main().catch((e) => { console.error(e); process.exit(1); });
