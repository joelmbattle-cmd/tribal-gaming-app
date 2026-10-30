/**
 * The bare "Import from Excel" toolbar path (no CAD plan, auto-creates banks on a grid)
 * is how duplicate banks got onto the Main Floor. Production must go through the
 * Floor Setup wizard (DXF Create → Excel merge). The legacy path survives only for
 * local dev / demo seeding when explicitly enabled, and never on Vercel production.
 */
export const LEGACY_EXCEL_IMPORT_ENABLED =
  process.env.NEXT_PUBLIC_LEGACY_EXCEL_IMPORT === "1" && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

export const PLAN_FIRST_ERROR =
  "Create the floor from its CAD drawing first (Floor Setup → step 1). Excel only merges machines into banks that already exist on a CAD plan — importing before Create makes duplicate banks.";
export const NO_PLAN_MATCH_ERROR =
  "None of the Bank values in this sheet match a bank on a CAD plan. Check you picked the right Bank column / floor, or create that floor from its DXF first.";
