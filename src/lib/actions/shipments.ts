"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { uploadDocument } from "@/lib/blob";
import { extractShipmentFields } from "@/lib/shipment-extract";
import { revalidatePath } from "next/cache";

// Below this, an accepted field is trusted enough to also overwrite the
// shipment record / auto-link a matching machine. Below it, the field is
// still accepted into the extracted-fields ledger but left for a human to
// reconcile onto the record by hand.
const AUTO_APPLY_CONFIDENCE = 0.7;

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

  // Run the extract pass on every upload to an editable shipment. A fresh
  // set of proposals replaces whatever was still pending review from an
  // earlier upload, rather than piling up — the human reviews one current
  // batch at a time. Closed shipments are view-only, so there is no review
  // UI for them to land in — skip the pass rather than leave orphan rows.
  const shipment = await db.shipment.findUnique({ where: { id: shipmentId }, select: { status: true } });
  const proposed = shipment && shipment.status !== "Closed" ? await extractShipmentFields(shipmentId, file.name) : [];
  await db.$transaction([
    db.shipmentField.deleteMany({ where: { shipmentId, status: "PROPOSED" } }),
    ...(proposed.length
      ? [
          db.shipmentField.createMany({
            data: proposed.map((f) => ({ shipmentId, key: f.key, value: f.value, confidence: f.confidence, status: "PROPOSED" as const })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/compliance/shipments");
  return { id: doc.id, storage: upload.status, proposedFieldCount: proposed.length };
}

export type AcceptedExtractionField = { id: string; key: string; value: string; confidence: number | null };

// Human review "accept": commits the (possibly edited) proposed values as
// this shipment's extracted fields, and — only for fields confident enough
// to trust unattended — also applies them onto the shipment record itself
// (carrier/vendor/dates) or links a matching machine by serial.
export async function acceptShipmentExtractionAction(shipmentId: string, fields: AcceptedExtractionField[]) {
  await requireRole("COMPLIANCE");
  const shipment = await requireEditableShipment(shipmentId);

  const cleaned = fields.map((f) => ({ ...f, value: f.value.trim() })).filter((f) => f.value.length > 0);
  if (cleaned.length > 0) {
    await db.$transaction(
      cleaned.map((f) => db.shipmentField.update({ where: { id: f.id }, data: { value: f.value, status: "ACCEPTED" } })),
    );
  }

  const byKey = new Map(cleaned.map((f) => [f.key, f]));
  const isConfident = (f: AcceptedExtractionField | undefined) => !!f && (f.confidence ?? 0) >= AUTO_APPLY_CONFIDENCE;

  const shipmentUpdate: { carrier?: string; vendor?: string; shippingDate?: Date; estimatedArrivalDate?: Date } = {};
  const carrier = byKey.get("carrier");
  if (isConfident(carrier)) shipmentUpdate.carrier = carrier!.value;
  const vendor = byKey.get("vendor");
  if (isConfident(vendor)) shipmentUpdate.vendor = vendor!.value;
  const shippingDate = byKey.get("shippingDate");
  if (isConfident(shippingDate)) {
    const d = new Date(shippingDate!.value);
    if (!Number.isNaN(d.getTime())) shipmentUpdate.shippingDate = d;
  }
  const eta = byKey.get("estimatedArrivalDate");
  if (isConfident(eta)) {
    const d = new Date(eta!.value);
    if (!Number.isNaN(d.getTime())) shipmentUpdate.estimatedArrivalDate = d;
  }
  if (Object.keys(shipmentUpdate).length > 0) {
    await db.shipment.update({ where: { id: shipment.id }, data: shipmentUpdate });
  }

  let linkedMachines = 0;
  const serials = byKey.get("serials");
  if (isConfident(serials)) {
    const list = [...new Set(serials!.value.split(",").map((s) => s.trim()).filter(Boolean))];
    if (list.length > 0) {
      const matches = await db.machine.findMany({ where: { serial: { in: list } } });
      for (const m of matches) {
        await db.shipmentMachine.upsert({
          where: { shipmentId_machineId: { shipmentId, machineId: m.id } },
          update: {},
          create: { shipmentId, machineId: m.id },
        });
        linkedMachines++;
      }
    }
  }

  revalidatePath("/compliance/shipments");
  revalidatePath("/compliance/machines");
  return { linkedMachines };
}

// Discards the current pending-review batch without touching accepted
// history — used when the human decides the proposals aren't worth keeping.
export async function dismissShipmentExtractionAction(shipmentId: string) {
  await requireRole("COMPLIANCE");
  await requireEditableShipment(shipmentId);
  await db.shipmentField.deleteMany({ where: { shipmentId, status: "PROPOSED" } });
  revalidatePath("/compliance/shipments");
}

export async function deleteShipmentDocumentAction(documentId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentDocument.delete({
    where: { id: documentId },
  });
  revalidatePath("/compliance/shipments");
}
