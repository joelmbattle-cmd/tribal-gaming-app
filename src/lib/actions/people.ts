"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
import { storePhoto } from "@/lib/photo";
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

export async function uploadPersonPhotoAction(personId: string, formData: FormData) {
  await requireRole("LICENSING");
  const file = formData.get("file") as File | null;
  const photo = await storePhoto(file, `people/${personId}/photo`);

  // Only write photoUrl on a real store. Writing unconditionally would erase a
  // photo already on file whenever an upload fails.
  if (photo.status === "stored") {
    await db.person.update({
      where: { id: personId },
      data: { photoUrl: photo.url },
    });
  }

  revalidatePath("/licensing/profiles");
  return photo.status === "stored"
    ? { storage: "stored" as const, inline: photo.inline }
    : { storage: photo.status };
}

export async function addPersonDocumentAction(personId: string, formData: FormData) {
  await requireRole("LICENSING");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const upload = await uploadDocument(file, `people/${personId}`);

  const doc = await db.personDocument.create({
    data: {
      personId,
      name: file.name,
      blobUrl: upload.status === "uploaded" ? upload.url : null,
      // PersonDocument.date has no default in the schema, unlike its siblings;
      // without this every attached document renders as "pending" forever.
      date: new Date(),
    },
  });

  revalidatePath("/licensing/profiles");
  return { id: doc.id, storage: upload.status };
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
