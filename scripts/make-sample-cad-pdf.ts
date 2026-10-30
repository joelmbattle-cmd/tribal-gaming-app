// Writes a tiny layered vector "CAD plot" PDF (OCG layers OUTLINE, BANKS,
// BANK_TEXT, SEATS, SEAT_TEXT) for exercising the Floor Setup PDF importer.
// Usage: npx tsx scripts/make-sample-cad-pdf.ts [out.pdf]
import { writeFileSync } from "node:fs";

const layers = ["OUTLINE", "BANKS", "BANK_TEXT", "SEATS", "SEAT_TEXT"];
const rect = (x: number, y: number, w: number, h: number) => `${x} ${y} ${w} ${h} re S\n`;
const text = (x: number, y: number, s: string) => `BT /F1 8 Tf 1 0 0 1 ${x} ${y} Tm (${s}) Tj ET\n`;
const oc = (i: number, body: string) => `/OC /L${i} BDC\n${body}EMC\n`;

const outline = rect(20, 20, 560, 380);
let banks = "", bankText = "", seats = "", seatText = "";
const defs = [
  { tag: "101", x: 60, y: 260, cols: 4 },
  { tag: "102", x: 60, y: 120, cols: 3 },
  { tag: "103", x: 320, y: 200, cols: 5 },
];
for (const b of defs) {
  const w = b.cols * 40 + 20;
  banks += rect(b.x, b.y, w, 80);
  bankText += text(b.x + 8, b.y + 66, b.tag);
  for (let i = 0; i < b.cols; i++) {
    const sx = b.x + 10 + i * 40;
    seats += rect(sx + 4, b.y + 10, 30, 30);
    seatText += text(sx + 14, b.y + 20, String(i + 1).padStart(2, "0"));
  }
}
// Draw an L-shaped (irregular) bank with plain lines + h, not re.
banks += "200 40 m 300 40 l 300 100 l 250 100 l 250 70 l 200 70 l h S\n";
bankText += text(206, 50, "104");
seats += rect(210, 44, 22, 20) + rect(262, 74, 22, 20);
seatText += text(216, 50, "01") + text(268, 80, "02");

const content = "0 0 1 RG\n" + [outline, banks, bankText, seats, seatText].map((b, i) => oc(i, b)).join("");
const objs: string[] = [];
objs[1] = "<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [" + layers.map((_, i) => `${10 + i} 0 R`).join(" ") +
  "] /D << /ON [" + layers.map((_, i) => `${10 + i} 0 R`).join(" ") + "] >> >> >>";
objs[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
objs[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 420] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> /Properties << " +
  layers.map((_, i) => `/L${i} ${10 + i} 0 R`).join(" ") + " >> >> >>";
objs[4] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`;
objs[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
layers.forEach((n, i) => (objs[10 + i] = `<< /Type /OCG /Name (${n}) >>`));

let pdf = "%PDF-1.6\n";
const offsets: number[] = [];
for (let i = 1; i < objs.length; i++) {
  if (!objs[i]) continue;
  offsets[i] = Buffer.byteLength(pdf);
  pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
for (let i = 1; i < objs.length; i++) pdf += offsets[i] != null ? `${String(offsets[i]).padStart(10, "0")} 00000 n \n` : "0000000000 65535 f \n";
pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(process.argv[2] ?? "sample-floor-cad.pdf", pdf);
