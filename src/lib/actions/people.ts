"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export async function createPersonAction(name: string, role: string, status: string) {
  await requireRole("LICENSING");
  const person = await db.person.create({
    data: {
      name,
      role,
      status,
    },
  });
  revalidatePath("/licensing/profiles");
  return person;
}

export async function uploadPersonPhotoAction(personId: string, photoData?: string) {
  await requireRole("LICENSING");
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

  await db.person.update({
    where: { id: personId },
    data: { photoUrl },
  });
  revalidatePath("/licensing/profiles");
}

export async function addPersonDocumentAction(personId: string, name: string, fileData?: string) {
  await requireRole("LICENSING");
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

  const doc = await db.personDocument.create({
    data: {
      personId,
      name,
      blobUrl,
    },
  });
  revalidatePath("/licensing/profiles");
  return doc;
}

export async function deletePersonDocumentAction(documentId: string) {
  await requireRole("LICENSING");
  await db.personDocument.delete({
    where: { id: documentId },
  });
  revalidatePath("/licensing/profiles");
}

export async function archivePersonAction(personId: string) {
  await requireRole("LICENSING");
  await db.person.update({
    where: { id: personId },
    data: { archived: true },
  });
  revalidatePath("/licensing/profiles");
}
