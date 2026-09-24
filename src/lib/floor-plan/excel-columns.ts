// Column mapping for the floor-setup Excel import. Agencies' slot exports
// rarely use our template headers, so the user confirms a header → field
// mapping (auto-guessed here) and rows are rewritten to the canonical keys the
// import action already understands.

export const IMPORT_FIELDS = [
  { key: "Serial Number", required: true, aliases: ["serial number", "serial", "serial no", "serial #", "serialnumber", "sn", "egm serial", "machine serial"] },
  { key: "Bank", required: true, aliases: ["bank", "bank id", "bank name", "bank number", "bank no", "bank #", "bank code", "location"] },
  { key: "Seat", required: false, aliases: ["seat", "seat number", "seat no", "seat #", "position", "pos", "slot", "stand"] },
  { key: "Asset Number", required: false, aliases: ["asset number", "asset", "asset no", "asset #", "asset tag", "asset id"] },
  { key: "Manufacturer", required: false, aliases: ["manufacturer", "mfr", "mfg", "make", "vendor", "oem"] },
  { key: "Model", required: false, aliases: ["model", "cabinet", "machine model", "cabinet model"] },
  { key: "Game Theme", required: false, aliases: ["game theme", "theme", "game", "game name", "game title", "title"] },
  { key: "PAR Sheet", required: false, aliases: ["par sheet", "par", "par #", "par number", "par sheet number"] },
  { key: "Seal Number", required: false, aliases: ["seal number", "seal", "seal #", "seal no"] },
  { key: "Compliance Status", required: false, aliases: ["compliance status", "compliance", "status"] },
  { key: "Software Status", required: false, aliases: ["software status", "software", "software state"] },
  { key: "Status Since", required: false, aliases: ["status since", "since", "status date"] },
  { key: "Lifecycle Status", required: false, aliases: ["lifecycle status", "lifecycle", "life cycle", "asset status", "machine status"] },
  { key: "Area", required: false, aliases: ["area", "zone", "floor area"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
/** canonical field → source header (or "" for unmapped) */
export type ColumnMapping = Record<ImportFieldKey, string>;

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, ""])) as ColumnMapping;
  const taken = new Set<string>();
  // Exact alias hits first so "Status" can't steal a column that is really
  // "Software Status" (which is an exact alias of another field).
  for (const pass of ["exact", "contains"] as const) {
    for (const f of IMPORT_FIELDS) {
      if (mapping[f.key]) continue;
      const hit = headers.find((h) => {
        if (taken.has(h)) return false;
        const n = norm(h);
        if (!n) return false;
        return pass === "exact" ? f.aliases.some((a) => a === n) : f.aliases.some((a) => a.length > 3 && n.includes(a));
      });
      if (hit) {
        mapping[f.key] = hit;
        taken.add(hit);
      }
    }
  }
  return mapping;
}

/** Excel dates arrive as JS Dates (cellDates) or serial numbers; the server also accepts ISO strings. */
function cellToString(v: unknown): unknown {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return v;
}

export function applyMapping(rows: Record<string, unknown>[], mapping: ColumnMapping): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const f of IMPORT_FIELDS) {
      const src = mapping[f.key];
      if (src) out[f.key] = cellToString(row[src]);
    }
    return out;
  });
}
