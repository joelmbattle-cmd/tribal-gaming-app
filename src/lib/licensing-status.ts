import type { LicensingApplicationStatus } from "@/generated/prisma/enums";
import type { DocumentSlot } from "@/lib/document-slots";

export type { LicensingApplicationStatus };

export type LicensingStatusDef = {
  key: LicensingApplicationStatus;
  label: string;
};

// The Licensing list's status picker and folder tabs. "Critical docs
// incomplete" is NOT one of these — it's a separate, computed smart folder
// (see isCriticalDocsIncomplete below) based on document completeness, not
// a value a profile's status can actually hold.
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
 * The three document slots that gate the results chain (see
 * src/lib/document-slots.ts). A profile is "critical docs incomplete" when
 * any of these three is still missing at least one file — independent of
 * the profile's status, so a profile can (and often will) show up in both
 * its status folder and this smart folder at the same time.
 */
const CRITICAL_RESULT_SLOTS: DocumentSlot[] = ["NOTICE_OF_RESULTS", "NO_OBJECTION_LETTER", "LICENSE_ISSUANCE"];

export function isCriticalDocsIncomplete(documents: { slot: DocumentSlot | null }[]): boolean {
  return CRITICAL_RESULT_SLOTS.some((slot) => !documents.some((d) => d.slot === slot));
}
