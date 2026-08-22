"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
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

export async function uploadExclusionPhotoAction(exclusionId: string, photoData?: string) {
  await requireRole("COMPLIANCE");
  let photoUrl: string | null = null;

  if (photoData) {
    try {
      const blob = await fetch(process.env.BLOB_UPLOAD_URL || "", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
        body: Buffer.from(photoData, "base64"),
      }).then((r) => r.json() as Promise<{ url?: string }>);
      photoUrl = blob.url || null;
    } catch {
      // Silently fail - photo-optional mode
    }
  }

  await db.exclusion.update({
    where: { id: exclusionId },
    data: { photoUrl },
  });
  revalidatePath("/compliance/exclusions");
}

export async function addExclusionDocumentAction(exclusionId: string, name: string, fileData?: string) {
  await requireRole("COMPLIANCE");
  let blobUrl: string | null = null;

  if (fileData) {
    try {
      const blob = await fetch(process.env.BLOB_UPLOAD_URL || "", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
        body: Buffer.from(fileData, "base64"),
      }).then((r) => r.json() as Promise<{ url?: string }>);
      blobUrl = blob.url || null;
    } catch {
      // Silently fail - document records without blob URL (metadata-only mode)
    }
  }

  const doc = await db.exclusionDocument.create({
    data: {
      exclusionId,
      name,
      blobUrl,
    },
  });
  revalidatePath("/compliance/exclusions");
  return doc;
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
