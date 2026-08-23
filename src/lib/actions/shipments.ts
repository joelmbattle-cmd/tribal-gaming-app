"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
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

export async function addShipmentDocumentAction(shipmentId: string, formData: FormData) {
  await requireRole("COMPLIANCE");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const upload = await uploadDocument(file, `shipments/${shipmentId}`);

  const doc = await db.shipmentDocument.create({
    data: {
      shipmentId,
      name: file.name,
      blobUrl: upload.status === "uploaded" ? upload.url : null,
      date: new Date(),
    },
  });

  revalidatePath("/compliance/shipments");
  return { id: doc.id, storage: upload.status };
}

export async function deleteShipmentDocumentAction(documentId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentDocument.delete({
    where: { id: documentId },
  });
  revalidatePath("/compliance/shipments");
}
