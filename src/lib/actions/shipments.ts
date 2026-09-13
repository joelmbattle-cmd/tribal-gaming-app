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

export type ShipmentIntake = {
  type: "Inbound" | "Outbound";
  vendor: string;
  carrier: string;
  notifyEmails: string[];
  machineIds: string[];
};

export async function createShipmentAction(intake: ShipmentIntake) {
  await requireRole("COMPLIANCE");

  const type = intake.type === "Outbound" ? "Outbound" : "Inbound";
  const vendor = intake.vendor.trim();
  const carrier = intake.carrier.trim();
  if (!vendor || !carrier) throw new Error("Vendor/Shipper and Carrier are required");

  const shipment = await db.shipment.create({
    data: {
      type,
      vendor,
      carrier,
      received: new Date(),
      status: "Open",
      notify: { create: intake.notifyEmails.map((email) => ({ email })) },
      machines: { create: [...new Set(intake.machineIds)].map((machineId) => ({ machineId })) },
    },
  });
  revalidatePath("/compliance/shipments");
  revalidatePath("/compliance/machines");
  return shipment;
}

export async function linkShipmentMachineAction(shipmentId: string, machineId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentMachine.upsert({
    where: { shipmentId_machineId: { shipmentId, machineId } },
    update: {},
    create: { shipmentId, machineId },
  });
  revalidatePath("/compliance/shipments");
  revalidatePath("/compliance/machines");
}

export async function unlinkShipmentMachineAction(shipmentId: string, machineId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentMachine.delete({
    where: { shipmentId_machineId: { shipmentId, machineId } },
  });
  revalidatePath("/compliance/shipments");
  revalidatePath("/compliance/machines");
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
