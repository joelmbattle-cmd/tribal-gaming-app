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
  shippingDate: string; // yyyy-mm-dd
  estimatedArrivalDate?: string; // yyyy-mm-dd
  notifyEmails: string[];
  machineIds: string[];
};

function normalizeShipmentFields(fields: {
  type: "Inbound" | "Outbound";
  vendor: string;
  carrier: string;
  shippingDate: string;
  estimatedArrivalDate?: string;
}) {
  const type = fields.type === "Outbound" ? "Outbound" : "Inbound";
  const vendor = fields.vendor.trim();
  const carrier = fields.carrier.trim();
  if (!vendor || !carrier) throw new Error("Vendor/Shipper and Carrier are required");
  if (!fields.shippingDate) throw new Error("Shipping Date is required");

  return {
    type,
    vendor,
    carrier,
    shippingDate: new Date(fields.shippingDate),
    estimatedArrivalDate: fields.estimatedArrivalDate ? new Date(fields.estimatedArrivalDate) : null,
  };
}

// Server-side backstop for the "Closed shipments are view-only" rule — the UI
// hides edit affordances once closed, but this keeps a direct action call
// from bypassing it.
async function requireEditableShipment(shipmentId: string) {
  const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error("Shipment not found");
  if (shipment.status === "Closed") throw new Error("Closed shipments cannot be edited");
  return shipment;
}

export async function createShipmentAction(intake: ShipmentIntake) {
  await requireRole("COMPLIANCE");
  const fields = normalizeShipmentFields(intake);

  const shipment = await db.shipment.create({
    data: {
      ...fields,
      status: "Open",
      notify: { create: intake.notifyEmails.map((email) => ({ email })) },
      machines: { create: [...new Set(intake.machineIds)].map((machineId) => ({ machineId })) },
    },
  });
  revalidatePath("/compliance/shipments");
  revalidatePath("/compliance/machines");
  return shipment;
}

export type ShipmentDetailsUpdate = {
  type: "Inbound" | "Outbound";
  vendor: string;
  carrier: string;
  shippingDate: string;
  estimatedArrivalDate?: string;
  notifyEmails: string[];
};

// Edits Type/Vendor/Carrier/dates plus the notify list in one pass — the
// email list is diffed against current recipients so an untouched address
// keeps its existing `sent` flag instead of being recreated as unsent.
export async function updateShipmentDetailsAction(shipmentId: string, update: ShipmentDetailsUpdate) {
  await requireRole("COMPLIANCE");
  const shipment = await requireEditableShipment(shipmentId);
  const fields = normalizeShipmentFields(update);

  const currentRecipients = await db.shipmentRecipient.findMany({ where: { shipmentId } });
  const desiredEmails = [...new Set(update.notifyEmails.map((e) => e.trim()).filter(Boolean))];
  const currentEmails = new Set(currentRecipients.map((r) => r.email));
  const toRemove = currentRecipients.filter((r) => !desiredEmails.includes(r.email));
  const toAdd = desiredEmails.filter((email) => !currentEmails.has(email));

  await db.$transaction([
    db.shipment.update({ where: { id: shipment.id }, data: fields }),
    ...toRemove.map((r) => db.shipmentRecipient.delete({ where: { id: r.id } })),
    ...toAdd.map((email) => db.shipmentRecipient.create({ data: { shipmentId, email } })),
  ]);

  revalidatePath("/compliance/shipments");
}

export async function linkShipmentMachineAction(shipmentId: string, machineId: string) {
  await requireRole("COMPLIANCE");
  await requireEditableShipment(shipmentId);
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
  await requireEditableShipment(shipmentId);
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
