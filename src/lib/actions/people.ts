"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
import { storePhoto } from "@/lib/photo";
import { revalidatePath } from "next/cache";

export type PersonIntake = {
  name: string;
  role: string;
  status: string;
  dateOfBirth?: string; // yyyy-mm-dd from a date input
  contactInfo?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseIssueDate?: string;
  licenseExpirationDate?: string;
  applicationDate?: string;
  applicationStatus?: string;
  backgroundStatus?: string;
  suitabilityDetermination?: string;
  assignedInvestigator?: string;
  investigationStartDate?: string;
  investigationCompletionDate?: string;
  keyFindings?: string;
};

function toDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null;
}

export async function createPersonAction(intake: PersonIntake) {
  const user = await requireRole("LICENSING");
  const person = await db.person.create({
    data: {
      name: intake.name,
      role: intake.role,
      status: intake.status,
      dateOfBirth: toDateOrNull(intake.dateOfBirth),
      contactInfo: intake.contactInfo || null,
      licenseType: intake.licenseType || null,
      licenseNumber: intake.licenseNumber || null,
      licenseIssueDate: toDateOrNull(intake.licenseIssueDate),
      licenseExpirationDate: toDateOrNull(intake.licenseExpirationDate),
      applicationDate: toDateOrNull(intake.applicationDate),
      applicationStatus: intake.applicationStatus || null,
      backgroundStatus: intake.backgroundStatus || null,
      suitabilityDetermination: intake.suitabilityDetermination || null,
      assignedInvestigator: intake.assignedInvestigator || null,
      investigationStartDate: toDateOrNull(intake.investigationStartDate),
      investigationCompletionDate: toDateOrNull(intake.investigationCompletionDate),
      keyFindings: intake.keyFindings || null,
      createdBy: user.name,
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

export async function addPersonDocumentAction(personId: string, formData: FormData) {
  const user = await requireRole("LICENSING");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const upload = await uploadDocument(file, `people/${personId}`);

  const [doc] = await db.$transaction([
    db.personDocument.create({
      data: {
        personId,
        name: file.name,
        blobUrl: upload.status === "uploaded" ? upload.url : null,
        // PersonDocument.date has no default in the schema, unlike its siblings;
        // without this every attached document renders as "pending" forever.
        date: new Date(),
      },
    }),
    db.person.update({ where: { id: personId }, data: { lastModifiedBy: user.name } }),
  ]);

  revalidatePath("/licensing/profiles");
  return { id: doc.id, storage: upload.status };
}

export async function deletePersonDocumentAction(documentId: string) {
  const user = await requireRole("LICENSING");
  const doc = await db.personDocument.delete({
    where: { id: documentId },
  });
  await db.person.update({ where: { id: doc.personId }, data: { lastModifiedBy: user.name } });
  revalidatePath("/licensing/profiles");
}

export async function archivePersonAction(personId: string) {
  const user = await requireRole("LICENSING");
  await db.person.update({
    where: { id: personId },
    data: { archived: true, lastModifiedBy: user.name },
  });
  revalidatePath("/licensing/profiles");
}
