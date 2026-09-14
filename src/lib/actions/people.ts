"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
import { storePhoto } from "@/lib/photo";
import { lockedReason, type DocumentSlot } from "@/lib/document-slots";
import { licensingStatusLabel, type LicensingApplicationStatus } from "@/lib/licensing-status";
import { resolveLicenseExpiration, addYears, DEFAULT_LICENSE_TERM_YEARS } from "@/lib/license-expiry";
import { buildForm, FORM_SLOT, FORM_LABEL, type FormType } from "@/lib/licensing-forms";
import { revalidatePath } from "next/cache";

export type PersonIntake = {
  name: string;
  role: string;
  status: string;
  dateOfBirth?: string; // yyyy-mm-dd from a date input
  contactInfo?: string;
  ssn?: string;
  position?: string;
  jobDescription?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseIssueDate?: string;
  licenseExpirationDate?: string;
  applicationDate?: string;
  applicationStatus?: LicensingApplicationStatus;
  backgroundStatus?: string;
  suitabilityDetermination?: string;
  assignedInvestigator?: string;
  investigationStartDate?: string;
  investigationCompletionDate?: string;
  keyFindings?: string;
  vendorCompanyId?: string;
};

function toDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null;
}

export async function createPersonAction(intake: PersonIntake) {
  const user = await requireRole("LICENSING");
  const licenseIssueDate = toDateOrNull(intake.licenseIssueDate);
  // Renewal timeline (R? License Monitor): once a license is issued, default
  // its expiration to +2 years unless the approver typed a specific one —
  // any explicit value here always wins, of any length.
  const licenseExpirationDate = resolveLicenseExpiration(licenseIssueDate, toDateOrNull(intake.licenseExpirationDate));
  const person = await db.person.create({
    data: {
      name: intake.name,
      role: intake.role,
      status: intake.status,
      dateOfBirth: toDateOrNull(intake.dateOfBirth),
      contactInfo: intake.contactInfo || null,
      ssn: intake.ssn || null,
      position: intake.position || null,
      jobDescription: intake.jobDescription || null,
      licenseType: intake.licenseType || null,
      licenseNumber: intake.licenseNumber || null,
      licenseIssueDate,
      licenseExpirationDate,
      applicationDate: toDateOrNull(intake.applicationDate),
      applicationStatus: intake.applicationStatus || null,
      backgroundStatus: intake.backgroundStatus || null,
      suitabilityDetermination: intake.suitabilityDetermination || null,
      assignedInvestigator: intake.assignedInvestigator || null,
      investigationStartDate: toDateOrNull(intake.investigationStartDate),
      investigationCompletionDate: toDateOrNull(intake.investigationCompletionDate),
      keyFindings: intake.keyFindings || null,
      vendorCompanyId: intake.vendorCompanyId || null,
      createdBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/licensing/profiles");
  if (intake.vendorCompanyId) {
    revalidatePath("/licensing/vendors");
    revalidatePath(`/licensing/vendors/${intake.vendorCompanyId}`);
  }
  return person;
}

export type PersonUpdate = {
  name: string;
  role: string;
  status: string;
  dateOfBirth?: string; // yyyy-mm-dd from a date input
  contactInfo?: string;
  ssn?: string;
  position?: string;
  jobDescription?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseIssueDate?: string;
  licenseExpirationDate?: string;
  applicationDate?: string;
  applicationStatus?: LicensingApplicationStatus;
  backgroundStatus?: string;
  suitabilityDetermination?: string;
  assignedInvestigator?: string;
  investigationStartDate?: string;
  investigationCompletionDate?: string;
  keyFindings?: string;
};

export async function updatePersonAction(personId: string, intake: PersonUpdate) {
  const user = await requireRole("LICENSING");

  // Archived profiles are view-only. Checked server-side (not just hidden in
  // the UI) so a stale drawer or a crafted request can't edit a closed
  // profile — mirrors the Self-Exclusion edit guard.
  const existing = await db.person.findUnique({ where: { id: personId }, select: { archived: true } });
  if (!existing) throw new Error("Person not found");
  if (existing.archived) throw new Error("Cannot edit an archived profile");

  const licenseIssueDate = toDateOrNull(intake.licenseIssueDate);
  const licenseExpirationDate = resolveLicenseExpiration(licenseIssueDate, toDateOrNull(intake.licenseExpirationDate));

  const person = await db.person.update({
    where: { id: personId },
    data: {
      name: intake.name,
      role: intake.role,
      status: intake.status,
      dateOfBirth: toDateOrNull(intake.dateOfBirth),
      contactInfo: intake.contactInfo || null,
      ssn: intake.ssn || null,
      position: intake.position || null,
      jobDescription: intake.jobDescription || null,
      licenseType: intake.licenseType || null,
      licenseNumber: intake.licenseNumber || null,
      licenseIssueDate,
      licenseExpirationDate,
      applicationDate: toDateOrNull(intake.applicationDate),
      applicationStatus: intake.applicationStatus || null,
      backgroundStatus: intake.backgroundStatus || null,
      suitabilityDetermination: intake.suitabilityDetermination || null,
      assignedInvestigator: intake.assignedInvestigator || null,
      investigationStartDate: toDateOrNull(intake.investigationStartDate),
      investigationCompletionDate: toDateOrNull(intake.investigationCompletionDate),
      keyFindings: intake.keyFindings || null,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/licensing/profiles");
  return person;
}

export async function uploadPersonPhotoAction(personId: string, formData: FormData) {
  const user = await requireRole("LICENSING");
  const file = formData.get("file") as File | null;
  const photo = await storePhoto(file, `people/${personId}/photo`);

  // Only write photoUrl on a real store. Writing unconditionally would erase a
  // photo already on file whenever an upload fails.
  if (photo.status === "stored") {
    await db.person.update({
      where: { id: personId },
      data: { photoUrl: photo.url, lastModifiedBy: user.name },
    });
  }

  revalidatePath("/licensing/profiles");
  return photo.status === "stored"
    ? { storage: "stored" as const, inline: photo.inline }
    : { storage: photo.status };
}

/**
 * Every document a Licensing operator attaches now goes into one of the 11
 * checklist slots — the old free-form "Attach Document" list has been
 * replaced by the slot grid, so `slot` is required rather than optional.
 */
export async function addPersonDocumentAction(personId: string, slot: DocumentSlot, formData: FormData) {
  const user = await requireRole("LICENSING");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const person = await db.person.findUnique({
    where: { id: personId },
    select: {
      archived: true,
      documents: { select: { slot: true } },
      licenseIssueDate: true,
      licenseExpirationDate: true,
    },
  });
  if (!person) throw new Error("Person not found");
  // Archived profiles are view-only, and the results chain (Notice of
  // Results -> No-Objection letter -> License Issuance) can't be skipped —
  // both checked server-side so a stale drawer or a crafted request can't
  // bypass either gate.
  if (person.archived) throw new Error("Cannot modify documents on an archived profile");
  const blocked = lockedReason(slot, person.documents);
  if (blocked) throw new Error(blocked);

  const upload = await uploadDocument(file, `people/${personId}/${slot.toLowerCase()}`);
  const uploadDate = new Date();

  // License Monitor (renewal timeline): filing the first Issuance of License
  // document is "issuance completed" — default the license's expiration to
  // +2 years from here, and backfill an issue date too if the approver
  // hasn't set one via the License section yet. Only fires once (first such
  // document) and only fills in what's still missing — an expiration the
  // approver already set (any length) is left alone.
  const isFirstIssuanceDoc = slot === "LICENSE_ISSUANCE" && !person.documents.some((d) => d.slot === "LICENSE_ISSUANCE");
  const resolvedIssueDate = person.licenseIssueDate ?? uploadDate;
  const licenseIssueDate = isFirstIssuanceDoc ? resolvedIssueDate : undefined;
  const licenseExpirationDate =
    isFirstIssuanceDoc && !person.licenseExpirationDate ? addYears(resolvedIssueDate, DEFAULT_LICENSE_TERM_YEARS) : undefined;

  const [doc] = await db.$transaction([
    db.personDocument.create({
      data: {
        personId,
        slot,
        name: file.name,
        blobUrl: upload.status === "uploaded" ? upload.url : null,
        // PersonDocument.date has no default in the schema, unlike its siblings;
        // without this every attached document renders as "pending" forever.
        date: uploadDate,
      },
    }),
    db.person.update({
      where: { id: personId },
      data: { lastModifiedBy: user.name, licenseIssueDate, licenseExpirationDate },
    }),
  ]);

  revalidatePath("/licensing/profiles");
  return { id: doc.id, storage: upload.status };
}

/**
 * Static forms pass: renders a fixed HTML template from the profile's own
 * fields (no freeform AI) and files the result into the matching checklist
 * slot, same as a manual upload would. Returns the rendered HTML so the
 * caller can open it for preview/print immediately, independent of whether
 * blob storage is configured.
 */
export async function generatePersonFormAction(personId: string, formType: FormType) {
  const user = await requireRole("LICENSING");

  const person = await db.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      name: true,
      position: true,
      ssn: true,
      dateOfBirth: true,
      licenseType: true,
      licenseNumber: true,
      licenseIssueDate: true,
      licenseExpirationDate: true,
      suitabilityDetermination: true,
      applicationStatus: true,
      keyFindings: true,
      archived: true,
      documents: { select: { slot: true } },
    },
  });
  if (!person) throw new Error("Person not found");
  // Same view-only guard as every other document action, and the results
  // chain still applies — generating the Issuance form is no more allowed
  // to skip No-Objection than a manual upload would be.
  if (person.archived) throw new Error("Cannot generate forms for an archived profile");
  const slot = FORM_SLOT[formType];
  const blocked = lockedReason(slot, person.documents);
  if (blocked) throw new Error(blocked);

  const html = buildForm(formType, {
    id: person.id,
    name: person.name,
    position: person.position,
    ssn: person.ssn,
    dateOfBirth: person.dateOfBirth ? person.dateOfBirth.toISOString().slice(0, 10) : null,
    licenseType: person.licenseType,
    licenseNumber: person.licenseNumber,
    licenseIssueDate: person.licenseIssueDate ? person.licenseIssueDate.toISOString().slice(0, 10) : null,
    licenseExpirationDate: person.licenseExpirationDate ? person.licenseExpirationDate.toISOString().slice(0, 10) : null,
    suitabilityDeterminationLabel: person.suitabilityDetermination || "—",
    applicationStatusLabel: licensingStatusLabel(person.applicationStatus),
    keyFindings: person.keyFindings,
  });

  const fileName = `${FORM_LABEL[formType]}.html`;
  const file = new File([html], fileName, { type: "text/html" });
  const upload = await uploadDocument(file, `people/${personId}/${slot.toLowerCase()}`);
  const uploadDate = new Date();

  // Generating the Issuance of License form is "issuance completed" just
  // like manually filing that slot — same +2-year default as
  // addPersonDocumentAction, only filling in what's still missing.
  const isFirstIssuanceDoc = slot === "LICENSE_ISSUANCE" && !person.documents.some((d) => d.slot === "LICENSE_ISSUANCE");
  const resolvedIssueDate = person.licenseIssueDate ?? uploadDate;
  const licenseIssueDate = isFirstIssuanceDoc ? resolvedIssueDate : undefined;
  const licenseExpirationDate =
    isFirstIssuanceDoc && !person.licenseExpirationDate ? addYears(resolvedIssueDate, DEFAULT_LICENSE_TERM_YEARS) : undefined;

  const [doc] = await db.$transaction([
    db.personDocument.create({
      data: {
        personId,
        slot,
        name: fileName,
        blobUrl: upload.status === "uploaded" ? upload.url : null,
        date: uploadDate,
      },
    }),
    db.person.update({
      where: { id: personId },
      data: { lastModifiedBy: user.name, licenseIssueDate, licenseExpirationDate },
    }),
  ]);

  revalidatePath("/licensing/profiles");
  return { id: doc.id, html, storage: upload.status };
}

/**
 * Reserved entry point for a future background-check vendor integration —
 * not wired to any vendor yet (no OAuth/webhook exists), but deliberately
 * narrower than addPersonDocumentAction: it hardcodes slot to
 * BACKGROUND_CHECK so whatever eventually calls this function can never
 * write into any other checklist slot. Manual staff upload in the Background
 * Check box already calls addPersonDocumentAction directly with this same
 * slot; this function is the seam the disabled "Order Background Check"
 * button's future vendor flow will call instead, kept typed and in place
 * before that integration exists. When it's built, it will also need its
 * own service-to-service auth (e.g. a signed webhook secret) in place of
 * requireRole, since an external vendor can't hold an interactive staff
 * session.
 */
export async function addBackgroundCheckDocumentAction(personId: string, formData: FormData) {
  return addPersonDocumentAction(personId, "BACKGROUND_CHECK", formData);
}

/** Swaps the file behind an existing checklist slot entry without changing its id or slot. */
export async function replacePersonDocumentAction(documentId: string, formData: FormData) {
  const user = await requireRole("LICENSING");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const existing = await db.personDocument.findUnique({
    where: { id: documentId },
    select: { personId: true, slot: true, person: { select: { archived: true } } },
  });
  if (!existing) throw new Error("Document not found");
  if (existing.person.archived) throw new Error("Cannot modify documents on an archived profile");

  const upload = await uploadDocument(file, `people/${existing.personId}/${(existing.slot ?? "document").toLowerCase()}`);

  const [doc] = await db.$transaction([
    db.personDocument.update({
      where: { id: documentId },
      data: {
        name: file.name,
        blobUrl: upload.status === "uploaded" ? upload.url : null,
        date: new Date(),
      },
    }),
    db.person.update({ where: { id: existing.personId }, data: { lastModifiedBy: user.name } }),
  ]);

  revalidatePath("/licensing/profiles");
  return { id: doc.id, storage: upload.status };
}

export async function deletePersonDocumentAction(documentId: string) {
  const user = await requireRole("LICENSING");
  const existing = await db.personDocument.findUnique({
    where: { id: documentId },
    select: { personId: true, person: { select: { archived: true } } },
  });
  if (!existing) throw new Error("Document not found");
  if (existing.person.archived) throw new Error("Cannot modify documents on an archived profile");

  await db.personDocument.delete({ where: { id: documentId } });
  await db.person.update({ where: { id: existing.personId }, data: { lastModifiedBy: user.name } });
  revalidatePath("/licensing/profiles");
}

/**
 * No-Objection fan-out: one physical letter often covers many licensees, so
 * this uploads the file once and attaches the same blob URL to every
 * eligible selected profile's No-Objection slot in one pass. A profile is
 * skipped (not an error for the whole batch) when it's archived or hasn't
 * reached Notice of Results yet — the same gate `addPersonDocumentAction`
 * enforces one profile at a time.
 */
export async function attachNoObjectionLetterAction(personIds: string[], formData: FormData) {
  const user = await requireRole("LICENSING");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");
  if (personIds.length === 0) throw new Error("No profiles selected");

  const people = await db.person.findMany({
    where: { id: { in: personIds } },
    select: { id: true, archived: true, documents: { select: { slot: true } } },
  });

  const eligible = people.filter((p) => !p.archived && !lockedReason("NO_OBJECTION_LETTER", p.documents));
  const skipped = people.length - eligible.length;
  if (eligible.length === 0) {
    throw new Error("No eligible profiles — each needs Notice of Results on file and must not be archived");
  }

  // Upload once and reuse the same blob URL for every profile's row, rather
  // than re-uploading identical bytes per recipient.
  const upload = await uploadDocument(file, `people/no-objection-letters/${Date.now()}`);
  const now = new Date();

  await db.$transaction([
    ...eligible.map((p) =>
      db.personDocument.create({
        data: {
          personId: p.id,
          slot: "NO_OBJECTION_LETTER",
          name: file.name,
          blobUrl: upload.status === "uploaded" ? upload.url : null,
          date: now,
        },
      }),
    ),
    db.person.updateMany({ where: { id: { in: eligible.map((p) => p.id) } }, data: { lastModifiedBy: user.name } }),
  ]);

  revalidatePath("/licensing/profiles");
  return { attached: eligible.length, skipped, storage: upload.status };
}

export async function archivePersonAction(personId: string) {
  const user = await requireRole("LICENSING");
  await db.person.update({
    where: { id: personId },
    data: {
      archived: true,
      archivedAt: new Date(),
      archivedBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/licensing/profiles");
}

export async function unarchivePersonAction(personId: string) {
  const user = await requireRole("LICENSING");
  await db.person.update({
    where: { id: personId },
    data: {
      archived: false,
      restoredAt: new Date(),
      restoredBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/licensing/profiles");
}
