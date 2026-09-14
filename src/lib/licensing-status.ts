import type { LicensingApplicationStatus } from "@/generated/prisma/enums";
import type { DocumentSlot } from "@/lib/document-slots";

export type { LicensingApplicationStatus };

export type LicensingStatusDef = {
  key: LicensingApplicationStatus;
  label: string;
};

// The Licensing list's status picker and folder tabs. "Critical Pipeline" is
// NOT one of these — it's a separate, computed smart folder (see
// isCriticalPipeline below), not a value a profile's status can actually hold.
export const LICENSING_STATUSES: LicensingStatusDef[] = [
  { key: "APPLICATION_NOT_FINISHED", label: "Application not finished" },
  { key: "APPLICATION_TURNED_IN", label: "Application turned in" },
  { key: "READY_TO_REVIEW", label: "Ready to review" },
  { key: "APPROVED", label: "Approved" },
  { key: "TEMPORARY_LICENSE", label: "Temporary license" },
  { key: "DENIED", label: "Denied" },
  { key: "WITHDRAWN", label: "Withdrawn" },
];

export function licensingStatusLabel(status: LicensingApplicationStatus | null | undefined): string {
  return LICENSING_STATUSES.find((s) => s.key === status)?.label ?? "—";
}

/**
 * "Critical Pipeline" — profiles sitting at a specific stall point in the
 * results chain (Notice of Results -> No-Objection -> Issuance) rather than
 * simply "missing any of the three." A profile matches when ANY of:
 *
 *  1. No-Objection is on file but the NIGC receipt isn't — the letter is
 *     done but sending it to NIGC hasn't been confirmed yet.
 *  2. Status is Approved and Notice of Results is on file but No-Objection
 *     isn't — approved and results are in, but the letter hasn't gone out.
 *  3. Notice of Results and No-Objection are both on file but Issuance
 *     isn't — everything upstream is done, only issuing the license is left.
 *
 * Independent of the profile's status folder (rule 2 aside, which reads
 * status but doesn't require the profile currently be viewed under it), so
 * a profile can show up here and in its status folder at the same time.
 */
function hasSlot(documents: { slot: DocumentSlot | null }[], slot: DocumentSlot): boolean {
  return documents.some((d) => d.slot === slot);
}

/** Shared by both smart folders below: Notice of Results and No-Objection are both on file, but Issuance isn't yet. */
function isReadyForIssuance(documents: { slot: DocumentSlot | null }[]): boolean {
  return hasSlot(documents, "NOTICE_OF_RESULTS") && hasSlot(documents, "NO_OBJECTION_LETTER") && !hasSlot(documents, "LICENSE_ISSUANCE");
}

export function isCriticalPipeline(
  documents: { slot: DocumentSlot | null }[],
  applicationStatus: LicensingApplicationStatus | null | undefined,
): boolean {
  const hasNoticeOfResults = hasSlot(documents, "NOTICE_OF_RESULTS");
  const hasNoObjection = hasSlot(documents, "NO_OBJECTION_LETTER");
  const hasNigcReceipt = hasSlot(documents, "NIGC_RECEIPT");

  const noObjectionDoneNotConfirmedSent = hasNoObjection && !hasNigcReceipt;
  const approvedAwaitingNoObjection = applicationStatus === "APPROVED" && hasNoticeOfResults && !hasNoObjection;

  return noObjectionDoneNotConfirmedSent || approvedAwaitingNoObjection || isReadyForIssuance(documents);
}

/**
 * "Compliance" — a second, separate smart folder (dual-lists with status
 * folders and with Critical Pipeline). A profile matches when ANY of:
 *
 *  1. Fingerprints are on file but Notice of Results isn't — fingerprints
 *     submitted without a matching result yet on record.
 *  2. Ready for Issuance (see isReadyForIssuance) — everything upstream of
 *     the license record is done.
 */
export function isComplianceFlag(documents: { slot: DocumentSlot | null }[]): boolean {
  const fingerprintsWithoutResults = hasSlot(documents, "FINGERPRINTS") && !hasSlot(documents, "NOTICE_OF_RESULTS");
  return fingerprintsWithoutResults || isReadyForIssuance(documents);
}
