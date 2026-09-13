import { db } from "@/lib/db";

const machineLinkInclude = {
  machines: { include: { machine: true }, orderBy: { createdAt: "asc" as const } },
};

export async function getShipmentList() {
  return db.shipment.findMany({
    orderBy: { shippingDate: "desc" },
    include: { documents: { orderBy: { date: "asc" } }, extracted: true, notify: true, ...machineLinkInclude },
  });
}

export async function getShipment(id: string) {
  return db.shipment.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { date: "asc" } },
      extracted: true,
      notify: true,
      ...machineLinkInclude,
    },
  });
}

export type ShipmentDetail = NonNullable<Awaited<ReturnType<typeof getShipment>>>;

// Back-link for Machine Records: every shipment a given machine has been
// linked to, most recent first.
export async function getShipmentsForMachine(machineId: string) {
  const links = await db.shipmentMachine.findMany({
    where: { machineId },
    include: { shipment: true },
    orderBy: { shipment: { shippingDate: "desc" } },
  });
  return links.map((l) => l.shipment);
}
