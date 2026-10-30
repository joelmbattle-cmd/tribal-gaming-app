// Matching a spreadsheet's "Bank" cell to a bank already on the map (typically
// one created by the CAD import). Pure so the Excel preview (client) and the
// import itself (server) resolve identically.

/** `bankAssignments` value meaning "skip rows for this bank text". */
export const ASSIGN_SKIP = "__skip__";
/** `bankAssignments` value meaning "create a new bank with this text". */
export const ASSIGN_CREATE = "__create__";

export type BankRef = {
  id: string;
  name: string;
  /**
   * Whether a bare tag ("104") may resolve to this bank. Set for banks that
   * came from a CAD plan; demo/manually-created banks match by full name only,
   * so a stray "Bank 118" row can never pull machines into the demo floor.
   */
  tagMatch?: boolean;
};

export function normalizeBankName(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[‒-―]/g, "-") // en/em dashes
    .replace(/[^a-z0-9#\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "bank 104", "bank104", "#104", "104", "b-7a" → tag "104" / "104" / "104" / "104" / "7a"
const TAG_ONLY = /^(?:bank|b)?[\s#-]*([a-z]?\d+[a-z]?)$/;
const TAG_PREFIX = /^(?:bank|b)?[\s#-]*([a-z]?\d+[a-z]?)(?![a-z0-9])/;

/** The tag a cell refers to when it is *only* a tag ("104" or "Bank 104"). */
export function bareTag(raw: unknown): string | null {
  return TAG_ONLY.exec(normalizeBankName(raw))?.[1] ?? null;
}

/** The leading tag of a bank's name ("Bank 104 — Main Floor North" → "104"). */
function leadingTag(name: string): string | null {
  return TAG_PREFIX.exec(normalizeBankName(name))?.[1] ?? null;
}

export type BankMatch = { id: string; how: "exact" | "tag" };

/**
 * Resolves in order: (1) equal after normalisation, (2) the cell is just a
 * tag and exactly one tag-eligible bank's name leads with that tag. Anything ambiguous is
 * left unmatched — a wrong placement is worse than asking the user.
 */
export function buildBankMatcher(banks: BankRef[]) {
  const byName = new Map<string, string>();
  const byTag = new Map<string, string[]>();
  for (const b of banks) {
    const n = normalizeBankName(b.name);
    if (n && !byName.has(n)) byName.set(n, b.id);
    const t = b.tagMatch ? leadingTag(b.name) : null;
    if (t) byTag.set(t, [...(byTag.get(t) ?? []), b.id]);
  }
  return (raw: unknown): BankMatch | null => {
    const n = normalizeBankName(raw);
    if (!n) return null;
    const exact = byName.get(n);
    if (exact) return { id: exact, how: "exact" };
    const tag = bareTag(raw);
    const ids = tag ? byTag.get(tag) : undefined;
    return ids && ids.length === 1 ? { id: ids[0], how: "tag" } : null;
  };
}
