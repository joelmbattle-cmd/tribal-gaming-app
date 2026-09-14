import type { DocumentSlot } from "@/generated/prisma/enums";

export type { DocumentSlot };

export type DocumentSlotDef = {
  key: DocumentSlot;
  label: string;
  /** Slots 8-10 in the licensing checklist — surfaced with a distinct badge. */
  critical?: boolean;
  /**
   * The prior slot in the results chain. A slot with this set cannot be
   * uploaded to (single or via the No-Objection fan-out) until the
   * prerequisite slot has at least one file — Notice of Results must exist
   * before a No-Objection/objection letter, which must exist before the
   * license issuance record.
   */
  requires?: DocumentSlot;
};

// Fixed Licensing document checklist (R6) — the original 11 slots, plus
// Licensing actions and Separation notice (post-licensure lifecycle events,
// unrelated to the results chain, so neither carries a `requires`). Order
// here is display order in the profile drawer.
export const DOCUMENT_SLOTS: DocumentSlotDef[] = [
  { key: "APPLICATION", label: "Application" },
  { key: "ID_PHOTO", label: "Driver's license / ID photo" },
  { key: "SSN_CARD", label: "Social Security card" },
  { key: "CRIMINAL_HISTORY", label: "Criminal history documents" },
  { key: "FINGERPRINTS", label: "Fingerprints" },
  { key: "INVESTIGATIVE_REPORT", label: "Investigative report" },
  { key: "SUITABILITY_REPORT", label: "Suitability determination report" },
  { key: "NOTICE_OF_RESULTS", label: "Notice of results", critical: true },
  { key: "NO_OBJECTION_LETTER", label: "No-objection / objection letter", critical: true, requires: "NOTICE_OF_RESULTS" },
  { key: "LICENSE_ISSUANCE", label: "Issuance of license", critical: true, requires: "NO_OBJECTION_LETTER" },
  { key: "NIGC_RECEIPT", label: "NIGC receipt" },
  { key: "LICENSING_ACTIONS", label: "Licensing actions" },
  { key: "SEPARATION_NOTICE", label: "Separation notice" },
];

// Rendered as its own labeled box on the profile drawer, separate from the
// 11-slot checklist grid above — not one of DOCUMENT_SLOTS, so it doesn't
// get pulled into that grid's layout or numbering. Also the only slot a
// future background-check vendor integration is allowed to write to; see
// addBackgroundCheckDocumentAction in src/lib/actions/people.ts.
export const BACKGROUND_CHECK_SLOT: DocumentSlotDef = { key: "BACKGROUND_CHECK", label: "Background Check" };

const ALL_SLOT_DEFS: DocumentSlotDef[] = [...DOCUMENT_SLOTS, BACKGROUND_CHECK_SLOT];

export function slotDef(slot: DocumentSlot): DocumentSlotDef | undefined {
  return ALL_SLOT_DEFS.find((s) => s.key === slot);
}

export function slotLabel(slot: DocumentSlot): string {
  return slotDef(slot)?.label ?? slot;
}

/**
 * The unmet prerequisite for `slot` given a person's current documents, or
 * null when the slot is unlocked. Shared by the server actions (the real
 * gate) and the UI (which shows the same reasoning before the user even
 * tries to upload).
 */
export function lockedReason(
  slot: DocumentSlot,
  documents: { slot: DocumentSlot | null }[],
): string | null {
  const requires = slotDef(slot)?.requires;
  if (!requires) return null;
  const met = documents.some((d) => d.slot === requires);
  return met ? null : `Requires ${slotLabel(requires)} on file first`;
}
