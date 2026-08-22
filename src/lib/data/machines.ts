import { db } from "@/lib/db";

export async function getMachineList() {
  const machines = await db.machine.findMany({
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
    bankName: m.bank?.name ?? "Unassigned",
    areaLabel: m.bank?.area?.label ?? "Unknown",
  }));
}

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
