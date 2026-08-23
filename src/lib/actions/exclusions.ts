"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
import { storePhoto } from "@/lib/photo";
import { revalidatePath } from "next/cache";

export async function createExclusionAction(term: string, status: string) {
  await requireRole("COMPLIANCE");
  const exclusion = await db.exclusion.create({
    data: {
      term,
      status,
      enrolled: new Date(),
    },
  });
  revalidatePath("/compliance/exclusions");
  return exclusion;
}

export async function uploadExclusionPhotoAction(exclusionId: string, formData: FormData) {
  await requireRole("COMPLIANCE");
  const file = formData.get("file") as File | null;
  const photo = await storePhoto(file, `exclusions/${exclusionId}/photo`);

  // Only write photoUrl on a real store. Writing unconditionally would erase a
  // photo already on file whenever an upload fails.
  if (photo.status === "stored") {
    await db.exclusion.update({
      where: { id: exclusionId },
      data: { photoUrl: photo.url },
    });
  }

  revalidatePath("/compliance/exclusions");
  return photo.status === "stored"
    ? { storage: "stored" as const, inline: photo.inline }
    : { storage: photo.status };
}

export async function addExclusionDocumentAction(exclusionId: string, formData: FormData) {
  await requireRole("COMPLIANCE");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const upload = await uploadDocument(file, `exclusions/${exclusionId}`);

  const doc = await db.exclusionDocument.create({
    data: {
      exclusionId,
      name: file.name,
      blobUrl: upload.status === "uploaded" ? upload.url : null,
    },
  });

  revalidatePath("/compliance/exclusions");
  return { id: doc.id, storage: upload.status };
}

export async function deleteExclusionDocumentAction(documentId: string) {
  await requireRole("COMPLIANCE");
  await db.exclusionDocument.delete({
    where: { id: documentId },
  });
  revalidatePath("/compliance/exclusions");
}

export async function archiveExclusionAction(exclusionId: string) {
  await requireRole("COMPLIANCE");
  await db.exclusion.update({
    where: { id: exclusionId },
    data: { archived: true },
  });
  revalidatePath("/compliance/exclusions");
}
