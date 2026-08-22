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
