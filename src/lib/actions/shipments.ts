"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export async function sendShipmentNotificationsAction(shipmentId: string) {
  await requireRole("COMPLIANCE");
  await db.shipmentRecipient.updateMany({ where: { shipmentId }, data: { sent: true } });
  revalidatePath("/compliance/shipments");
}
