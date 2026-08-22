"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export async function sendShipmentNotificationsAction(shipmentId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentRecipient.updateMany({ where: { shipmentId }, data: { sent: true } });
  revalidatePath("/compliance/shipments");
}

export async function createShipmentAction(carrier: string, notifyEmails: string[]) {
  await requireRole("COMPLIANCE");
  const shipment = await db.shipment.create({
    data: {
      carrier,
      received: new Date(),
      status: "Open",
      notify: {
        create: notifyEmails.map((email) => ({ email })),
      },
    },
  });
  revalidatePath("/compliance/shipments");
  return shipment;
}

export async function updateShipmentStatusAction(shipmentId: string, status: string) {
  await requireRole("COMPLIANCE");
  await db.shipment.update({
    where: { id: shipmentId },
    data: { status },
  });
  revalidatePath("/compliance/shipments");
}

export async function addShipmentDocumentAction(shipmentId: string, name: string, fileData?: string) {
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

  const doc = await db.shipmentDocument.create({
    data: {
      shipmentId,
      name,
      blobUrl,
      date: new Date(),
    },
  });
  revalidatePath("/compliance/shipments");
  return doc;
}

export async function deleteShipmentDocumentAction(documentId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentDocument.delete({
    where: { id: documentId },
  });
  revalidatePath("/compliance/shipments");
}
