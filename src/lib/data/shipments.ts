import { db } from "@/lib/db";

export async function getShipmentList() {
  return db.shipment.findMany({
    orderBy: { received: "desc" },
    include: { documents: { orderBy: { date: "asc" } }, extracted: true, notify: true },
  });
}

export async function getShipment(id: string) {
  return db.shipment.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { date: "asc" } },
      extracted: true,
      notify: true,
    },
  });
}

export type ShipmentDetail = NonNullable<Awaited<ReturnType<typeof getShipment>>>;
