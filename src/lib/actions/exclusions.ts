"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
import { storePhoto } from "@/lib/photo";
import { revalidatePath } from "next/cache";

export type ExclusionIntake = {
  term: string;
  status: string;
  personName: string;
  aliases?: string;
  dateOfBirth?: string; // yyyy-mm-dd from a date input
  governmentId?: string;
  exclusionType: string;
  expirationDate?: string;
  restrictions?: string;
  sourceInitiated?: string;
};

export async function createExclusionAction(intake: ExclusionIntake) {
  const user = await requireRole("COMPLIANCE");
  const exclusion = await db.exclusion.create({
    data: {
      term: intake.term,
      status: intake.status,
      enrolled: new Date(),
      personName: intake.personName,
      aliases: intake.aliases || null,
      dateOfBirth: intake.dateOfBirth ? new Date(intake.dateOfBirth) : null,
      governmentId: intake.governmentId || null,
      exclusionType: intake.exclusionType,
      expirationDate: intake.expirationDate ? new Date(intake.expirationDate) : null,
      restrictions: intake.restrictions || null,
      sourceInitiated: intake.sourceInitiated || null,
      createdBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/compliance/exclusions");
  return exclusion;
}

export async function uploadExclusionPhotoAction(exclusionId: string, formData: FormData) {
  const user = await requireRole("COMPLIANCE");
  const file = formData.get("file") as File | null;
  const photo = await storePhoto(file, `exclusions/${exclusionId}/photo`);

  // Only write photoUrl on a real store. Writing unconditionally would erase a
  // photo already on file whenever an upload fails.
  if (photo.status === "stored") {
    await db.exclusion.update({
      where: { id: exclusionId },
      data: { photoUrl: photo.url, lastModifiedBy: user.name },
    });
  }

  revalidatePath("/compliance/exclusions");
  return photo.status === "stored"
    ? { storage: "stored" as const, inline: photo.inline }
    : { storage: photo.status };
}

export async function addExclusionDocumentAction(exclusionId: string, formData: FormData) {
  const user = await requireRole("COMPLIANCE");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const upload = await uploadDocument(file, `exclusions/${exclusionId}`);

  const [doc] = await db.$transaction([
    db.exclusionDocument.create({
      data: {
        exclusionId,
        name: file.name,
        blobUrl: upload.status === "uploaded" ? upload.url : null,
      },
    }),
    db.exclusion.update({ where: { id: exclusionId }, data: { lastModifiedBy: user.name } }),
  ]);

  revalidatePath("/compliance/exclusions");
  return { id: doc.id, storage: upload.status };
}

export async function deleteExclusionDocumentAction(documentId: string) {
  const user = await requireRole("COMPLIANCE");
  const doc = await db.exclusionDocument.delete({
    where: { id: documentId },
  });
  await db.exclusion.update({ where: { id: doc.exclusionId }, data: { lastModifiedBy: user.name } });
  revalidatePath("/compliance/exclusions");
}

export async function archiveExclusionAction(exclusionId: string) {
  const user = await requireRole("COMPLIANCE");
  await db.exclusion.update({
    where: { id: exclusionId },
    data: {
      archived: true,
      archivedAt: new Date(),
      archivedBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/compliance/exclusions");
}

export async function unarchiveExclusionAction(exclusionId: string) {
  const user = await requireRole("COMPLIANCE");
  await db.exclusion.update({
    where: { id: exclusionId },
    data: {
      archived: false,
      restoredAt: new Date(),
      restoredBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/compliance/exclusions");
}
