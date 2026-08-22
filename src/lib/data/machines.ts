import { db } from "@/lib/db";

export async function getMachineList() {
  const machines = await db.machine.findMany({
    include: { bank: true },
    orderBy: { serial: "asc" },
  });
  return machines.map((m) => ({
    id: m.id,
    serial: m.serial,
    manufacturer: m.manufacturer,
    model: m.model,
    theme: m.theme,
    complianceStatus: m.complianceStatus,
    softwareStatus: m.softwareStatus,
    statusSince: m.statusSince,
    bankName: m.bank?.name ?? "Unassigned",
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
