// Machine attributes from agency slot exports: the "Source Data" tab (Hold %,
// Video/Reel, Meter Denom, Mix Type, Free Play, Bios, Owner Type, Class) and
// the "VALIDATION" tab's software/firmware IDs. Audit-result columns (Overall,
// Override, V1–V3 Result, notes) intentionally stay out of Machine. Shared by the Excel import, the machine create/edit forms, and the
// detail view so parsing and labels stay in one place.

type Kind = "string" | "number" | "int" | "bool" | "videoReel" | "ownerType";

export const SOURCE_FIELDS = [
  // Source Data tab
  { key: "holdPercent", kind: "number", label: "Hold %", importKey: "Hold %", placeholder: "e.g. 8.5", aliases: ["hold %", "hold%", "hold percent", "hold pct", "hold", "theoretical hold", "theo hold"] },
  { key: "videoReel", kind: "videoReel", label: "Video/Reel", importKey: "Video/Reel", placeholder: "VIDEO or REEL", aliases: ["video/reel", "video / reel", "video reel", "videoreel", "reel/video"] },
  { key: "meterDenom", kind: "string", label: "Meter Denom", importKey: "Meter Denom", placeholder: "e.g. 0.01", aliases: ["meter denom", "meter denomination", "denom", "denomination", "accounting denom"] },
  { key: "mixType", kind: "string", label: "Mix Type", importKey: "Mix Type", placeholder: "", aliases: ["mix type", "mix", "mixtype"] },
  { key: "freePlayEnabled", kind: "bool", label: "Free Play Enabled", importKey: "Free Play Enabled", placeholder: "Y or N", aliases: ["free play enabled", "free play", "freeplay", "free play y/n", "free play enabled y/n", "fp enabled"] },
  { key: "bios", kind: "string", label: "Bios", importKey: "Bios", placeholder: "", aliases: ["bios", "bios version", "bios ver"] },
  { key: "ownerType", kind: "ownerType", label: "Owner Type", importKey: "Owner Type", placeholder: "OWN / DAILY FEE / COIN IN", aliases: ["owner type", "owner", "ownership", "ownership type", "own type"] },
  { key: "machineClass", kind: "int", label: "Class", importKey: "Class", placeholder: "2 or 3", aliases: ["class", "egd class", "machine class", "game class", "class 2/3"] },
  // VALIDATION tab — software / firmware IDs
  { key: "typeId", kind: "string", label: "TypeID", importKey: "TypeID", placeholder: "", aliases: ["typeid", "type id", "type #", "type no"] },
  { key: "masterprom", kind: "string", label: "Masterprom", importKey: "Masterprom", placeholder: "", aliases: ["masterprom", "master prom", "master eprom"] },
  { key: "gameProm", kind: "string", label: "Game Prom", importKey: "Game Prom", placeholder: "", aliases: ["game prom", "gameprom", "game eprom"] },
  { key: "progSoftware", kind: "string", label: "Prog. Software", importKey: "Prog. Software", placeholder: "", aliases: ["prog software", "prog. software", "progressive software", "prog sw"] },
  { key: "bvFirmware", kind: "string", label: "BV Firmware", importKey: "BV Firmware", placeholder: "", aliases: ["bv firmware", "bv fw", "bill validator firmware"] },
  { key: "bvType", kind: "string", label: "BV Type", importKey: "BV Type", placeholder: "", aliases: ["bv type", "bill validator type", "bill validator"] },
  { key: "printerFirmware", kind: "string", label: "Printer Firmware", importKey: "Printer Firmware", placeholder: "", aliases: ["printer firmware", "printer fw"] },
  { key: "printer", kind: "string", label: "Printer", importKey: "Printer", placeholder: "", aliases: ["printer", "printer type", "printer model"] },
  // VALIDATION tab — phase 1b attributes
  { key: "cabinetType", kind: "string", label: "Cabinet Type", importKey: "Cabinet Type", placeholder: "", aliases: ["cabinet type", "cab type"] },
  { key: "multiDenom", kind: "bool", label: "Multi Denom", importKey: "Multi Denom", placeholder: "Y or N", aliases: ["multi denom", "multidenom", "multi-denom", "multi denomination"] },
  { key: "hasBv", kind: "bool", label: "Has BV", importKey: "Has BV", placeholder: "Y or N", aliases: ["has bv", "bv y/n", "bv?"] },
  { key: "hasCoin", kind: "bool", label: "Has Coin", importKey: "Has Coin", placeholder: "Y or N", aliases: ["has coin", "coin y/n", "coin?", "coin"] },
  { key: "hasVideoPoker", kind: "bool", label: "Has Video Poker", importKey: "Has Video Poker", placeholder: "Y or N", aliases: ["has video poker", "video poker", "vp"] },
  { key: "isActive", kind: "bool", label: "Active", importKey: "Active", placeholder: "Y or N", aliases: ["active", "is active", "active y/n"] },
  { key: "coinFillAmount", kind: "number", label: "Coin Fill Amount", importKey: "Coin Fill Amount", placeholder: "", aliases: ["coin fill amount", "coin fill", "coin fill amt"] },
  { key: "initialFillAmount", kind: "number", label: "Initial Fill Amount", importKey: "Initial Fill Amount", placeholder: "", aliases: ["initial fill amount", "initial fill", "initial fill amt"] },
  { key: "gameType", kind: "string", label: "Game Type", importKey: "Game Type", placeholder: "", aliases: ["game type", "gametype"] },
  { key: "category", kind: "string", label: "Category", importKey: "Category", placeholder: "", aliases: ["category", "game category"] },
  { key: "subcategory", kind: "string", label: "Subcategory", importKey: "Subcategory", placeholder: "", aliases: ["subcategory", "sub category", "sub-category"] },
  { key: "cwa", kind: "string", label: "CWA", importKey: "CWA", placeholder: "", aliases: ["cwa"] },
  { key: "sectionZone", kind: "string", label: "Section/Zone", importKey: "Section/Zone", placeholder: "", aliases: ["section/zone", "section / zone", "section zone", "section"] },
] as const satisfies readonly { key: string; kind: Kind; label: string; importKey: string; placeholder: string; aliases: readonly string[] }[];

export type SourceFieldKey = (typeof SOURCE_FIELDS)[number]["key"];
/** Raw form/Excel values keyed by field. */
export type SourceFieldsInput = Partial<Record<SourceFieldKey, unknown>>;
type KindValue = { string: string; number: number; int: number; bool: boolean; videoReel: string; ownerType: string };
type FieldOf<K extends SourceFieldKey> = Extract<(typeof SOURCE_FIELDS)[number], { key: K }>;
export type SourceFieldsData = { [K in SourceFieldKey]: KindValue[FieldOf<K>["kind"]] | null };
type SourceValue = SourceFieldsData[SourceFieldKey];

export const EMPTY_SOURCE_FORM = Object.fromEntries(SOURCE_FIELDS.map((f) => [f.key, ""])) as Record<SourceFieldKey, string>;

const str = (v: unknown) => (v == null ? "" : String(v).trim());

const KIND = Object.fromEntries(SOURCE_FIELDS.map((f) => [f.key, f.kind])) as Record<SourceFieldKey, Kind>;

function parseOne(key: SourceFieldKey, v: unknown): SourceValue {
  const s = str(v);
  if (!s) return null;
  switch (KIND[key]) {
    case "number": {
      // Excel percent cells arrive as fractions (0.085); typed "8.5%" or "8.5".
      if (typeof v === "number") return key === "holdPercent" && v > 0 && v < 1 ? +(v * 100).toFixed(4) : v;
      const n = parseFloat(s.replace(/[%$,\s]/g, ""));
      return isNaN(n) ? null : n;
    }
    case "videoReel": {
      const u = s.toUpperCase();
      return u.startsWith("V") ? "VIDEO" : u.startsWith("R") ? "REEL" : s;
    }
    case "bool": {
      const u = s.toUpperCase();
      if (["Y", "YES", "TRUE", "1", "ON", "ENABLED", "X"].includes(u)) return true;
      if (["N", "NO", "FALSE", "0", "OFF", "DISABLED"].includes(u)) return false;
      return null;
    }
    case "ownerType": {
      const u = s.toUpperCase().replace(/[_\s]+/g, " ");
      return u === "OWNED" ? "OWN" : u;
    }
    case "int": {
      const m = s.match(/\d+/);
      return m ? parseInt(m[0], 10) : null;
    }
    default:
      return s;
  }
}

/**
 * Parse raw values into Prisma data. Only keys present in `raw` are returned;
 * with `skipBlank` (Excel re-import) blank cells are dropped instead of
 * clearing the stored value.
 */
export function parseSourceFields(raw: SourceFieldsInput, opts: { skipBlank?: boolean } = {}): Partial<SourceFieldsData> {
  const out: Record<string, unknown> = {};
  for (const f of SOURCE_FIELDS) {
    if (!(f.key in raw)) continue;
    const val = parseOne(f.key, raw[f.key]);
    if (val === null && opts.skipBlank) continue;
    out[f.key] = val;
  }
  return out as Partial<SourceFieldsData>;
}

/** Same as parseSourceFields but reads the Excel canonical keys ("Hold %", "Class", …). */
export function sourceFieldsFromImportRow(row: Record<string, unknown>, opts: { skipBlank?: boolean } = {}) {
  const raw: SourceFieldsInput = {};
  for (const f of SOURCE_FIELDS) if (f.importKey in row) raw[f.key] = row[f.importKey];
  return parseSourceFields(raw, opts);
}

export function pickSourceFields(m: SourceFieldsData): SourceFieldsData {
  return Object.fromEntries(SOURCE_FIELDS.map((f) => [f.key, m[f.key]])) as SourceFieldsData;
}

/** Display string ("" when unset). */
export function formatSourceField(key: SourceFieldKey, v: SourceValue): string {
  if (v == null) return "";
  if (key === "holdPercent") return `${v}%`;
  if (typeof v === "boolean") return v ? "Y" : "N";
  return String(v);
}

/** Form input value for a stored field (Free Play as Y/N, Hold % without the sign). */
export function sourceFieldFormValue(_key: SourceFieldKey, v: SourceValue): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Y" : "N";
  return String(v);
}
