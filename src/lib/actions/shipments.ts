"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
import { revalidatePath } from "next/cache";
import { simulateShipmentExtraction } from "@/lib/shipment-extract";

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

  const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error("Shipment not found");

  const upload = await uploadDocument(file, `shipments/${shipmentId}`);

  const doc = await db.shipmentDocument.create({
    data: {
      shipmentId,
      name: file.name,
      blobUrl: upload.status === "uploaded" ? upload.url : null,
      date: new Date(),
    },
  });

  const proposedCount = await runExtractionPass(shipment, file.name);

  revalidatePath("/compliance/shipments");
  return { id: doc.id, storage: upload.status, proposedCount };
}

export async function deleteShipmentDocumentAction(documentId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentDocument.delete({
    where: { id: documentId },
  });
  revalidatePath("/compliance/shipments");
}

// --- AI Extract + Review (V1) ------------------------------------------------
//
// A document upload triggers a simulated extraction pass (no model key wired
// up in V1 — see src/lib/shipment-extract.ts). Results land as "proposed"
// ShipmentField rows, editable by a human before they count as real shipment
// data. A fresh pass replaces any still-pending proposals from an earlier
// upload rather than piling up duplicates; already-accepted rows are never
// touched by a later pass.
async function runExtractionPass(
  shipment: { id: string; vendor: string; carrier: string; shippingDate: Date; estimatedArrivalDate: Date | null },
  documentName: string,
) {
  const [linkedMachineIds, allMachines] = await Promise.all([
    db.shipmentMachine.findMany({ where: { shipmentId: shipment.id }, select: { machineId: true } }),
    db.machine.findMany({ select: { id: true, serial: true } }),
  ]);
  const linked = new Set(linkedMachineIds.map((m) => m.machineId));
  const candidateSerials = allMachines.filter((m) => !linked.has(m.id)).map((m) => m.serial);

  const proposed = simulateShipmentExtraction({
    documentName,
    shipmentId: shipment.id,
    vendor: shipment.vendor,
    carrier: shipment.carrier,
    shippingDate: shipment.shippingDate.toISOString().slice(0, 10),
    estimatedArrivalDate: shipment.estimatedArrivalDate ? shipment.estimatedArrivalDate.toISOString().slice(0, 10) : null,
    candidateSerials,
  });

  await db.$transaction([
    db.shipmentField.deleteMany({ where: { shipmentId: shipment.id, status: "proposed" } }),
    db.shipmentField.createMany({
      data: proposed.map((f) => ({
        shipmentId: shipment.id,
        key: f.key,
        value: f.value,
        status: "proposed",
        matchKey: f.matchKey,
        confident: f.confident,
      })),
    }),
  ]);

  return proposed.length;
}

export type ShipmentFieldEdit = { id: string; value: string };

// Accepts one or more proposed fields with their (possibly human-edited)
// values. Confident fields carrying a matchKey also write back into the
// shipment record or link a related machine by serial; everything else is
// just recorded as an accepted extracted field.
export async function acceptShipmentFieldsAction(shipmentId: string, edits: ShipmentFieldEdit[]) {
  await requireRole("COMPLIANCE");
  await requireEditableShipment(shipmentId);
  if (edits.length === 0) return;

  const editById = new Map(edits.map((e) => [e.id, e.value]));
  const fields = await db.shipmentField.findMany({
    where: { id: { in: edits.map((e) => e.id) }, shipmentId, status: "proposed" },
  });

  const shipmentPatch: Partial<{ vendor: string; carrier: string; shippingDate: Date; estimatedArrivalDate: Date }> = {};
  const serialsToLink: string[] = [];

  for (const field of fields) {
    const value = (editById.get(field.id) ?? field.value).trim();
    if (!field.confident || !field.matchKey || !value) continue;

    if (field.matchKey === "vendor") shipmentPatch.vendor = value;
    else if (field.matchKey === "carrier") shipmentPatch.carrier = value;
    else if (field.matchKey === "serial") serialsToLink.push(value);
    else if (field.matchKey === "shippingDate" || field.matchKey === "estimatedArrivalDate") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) shipmentPatch[field.matchKey] = date;
    }
  }

  const matchedMachines = serialsToLink.length
    ? await db.machine.findMany({ where: { serial: { in: serialsToLink } }, select: { id: true } })
    : [];

  await db.$transaction([
    ...fields.map((field) =>
      db.shipmentField.update({
        where: { id: field.id },
        data: { value: (editById.get(field.id) ?? field.value).trim(), status: "accepted" },
      }),
    ),
    ...(Object.keys(shipmentPatch).length ? [db.shipment.update({ where: { id: shipmentId }, data: shipmentPatch })] : []),
    ...matchedMachines.map((m) =>
      db.shipmentMachine.upsert({
        where: { shipmentId_machineId: { shipmentId, machineId: m.id } },
        update: {},
        create: { shipmentId, machineId: m.id },
      }),
    ),
  ]);

  revalidatePath("/compliance/shipments");
  revalidatePath("/compliance/machines");
}

export async function discardProposedFieldAction(fieldId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentField.delete({ where: { id: fieldId, status: "proposed" } });
  revalidatePath("/compliance/shipments");
}
