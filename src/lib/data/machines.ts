import { db } from "@/lib/db";

export async function getMachineList(showArchived = false) {
  const machines = await db.machine.findMany({
    where: { archived: showArchived },
    include: { bank: { include: { area: true } } },
    orderBy: { serial: "asc" },
  });
  return machines.map((m) => ({
    id: m.id,
    serial: m.serial,
    assetNumber: m.assetNumber,
    sealNumber: m.sealNumber,
    manufacturer: m.manufacturer,
    model: m.model,
    theme: m.theme,
    complianceStatus: m.complianceStatus,
    softwareStatus: m.softwareStatus,
    statusSince: m.statusSince,
    bankName: m.archived ? "— Archived —" : (m.bank?.name ?? "Unassigned"),
    areaLabel: m.archived ? "—" : (m.bank?.area?.label ?? "Unknown"),
    archived: m.archived,
    archivedAt: m.archivedAt ? m.archivedAt.toISOString().slice(0, 10) : null,
    archivedBy: m.archivedBy,
  }));
}

// Lightweight list for the Shipments "Related Machines" picker — every
// machine regardless of archived state, since an outbound shipment can carry
// a machine already pulled from the floor (e.g. returned to the vendor).
export async function getMachineOptions() {
  const machines = await db.machine.findMany({
    orderBy: { serial: "asc" },
    select: { id: true, serial: true, manufacturer: true, model: true, archived: true },
  });
  return machines;
}

export type MachineOption = Awaited<ReturnType<typeof getMachineOptions>>[number];

export async function getMachine(serial: string) {
  return db.machine.findUnique({
    where: { serial },
    include: {
      bank: true,
      documents: { orderBy: { date: "asc" } },
      history: { orderBy: { date: "desc" } },
    },
  });
}

export type MachineListItem = Awaited<ReturnType<typeof getMachineList>>[number];
export type MachineDetail = NonNullable<Awaited<ReturnType<typeof getMachine>>>;
