"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { BANK_W } from "@/lib/floor-constants";
import type { ComplianceStatus } from "@/generated/prisma/enums";

export async function getMachinesForExportAction() {
  await requireRole("COMPLIANCE");
  const machines = await db.machine.findMany({
    include: { bank: { include: { area: true } }, documents: true, history: { orderBy: { date: "desc" }, take: 1 } },
    orderBy: { serial: "asc" },
  });

  return machines.map((m) => {
    const lastEvent = m.history[0];
    return {
      "Serial Number": m.serial,
      "Asset Number": m.assetNumber,
      Area: m.bank?.area.label ?? "",
      Bank: m.bank?.name ?? "",
      Seat: m.seatIndex != null ? m.seatIndex + 1 : "",
      Manufacturer: m.manufacturer,
      Model: m.model,
      "Game Theme": m.theme,
      "PAR Sheet": m.parSheet,
      "Seal Number": m.sealNumber,
      "Compliance Status": STATUS_LABEL[m.complianceStatus],
      "Software Status": m.softwareStatus,
      "Status Since": m.statusSince.toISOString().slice(0, 10),
      "Documents Attached": m.documents.length,
      "Last Audit Event": lastEvent?.event ?? "",
      "Last Audit Date": lastEvent ? lastEvent.date.toISOString().slice(0, 10) : "",
    };
  });
}

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  VERIFIED: "Verified",
  FLAGGED: "Flagged",
  PENDING: "Pending",
};

type ImportRow = Record<string, unknown>;

async function areaKeyFromLabel(areas: { key: string; label: string }[], raw: unknown) {
  const norm = String(raw ?? "").trim().toLowerCase();
  const found = areas.find((a) => a.label.toLowerCase() === norm || a.key === norm);
  return found ? found.key : areas[0].key;
}

export async function placeMachineInSeat(bankId: string, seatRaw: unknown): Promise<number> {
  const bank = await db.bank.findUnique({ where: { id: bankId }, include: { machines: true } });
  if (!bank) throw new Error("Bank not found");
  const occupied = new Set(bank.machines.map((m) => m.seatIndex).filter((i): i is number => i !== null));

  const seatIdx = parseInt(String(seatRaw ?? ""), 10);
  if (!isNaN(seatIdx) && seatIdx >= 1 && seatIdx <= bank.capacity && !occupied.has(seatIdx - 1)) {
    return seatIdx - 1;
  }
  for (let i = 0; i < bank.capacity; i++) {
    if (!occupied.has(i)) return i;
  }
  await db.bank.update({ where: { id: bankId }, data: { capacity: bank.capacity + 1 } });
  return bank.capacity;
}

export async function importMachinesAction(rows: ImportRow[]) {
  await requireRole("COMPLIANCE");
  const areas = await db.area.findMany({ orderBy: { order: "asc" } });
  const settings = await db.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  let created = 0;
  let updated = 0;
  let banksCreated = 0;
  let skipped = 0;

  for (const row of rows) {
    const serial = String(row["Serial Number"] ?? "").trim();
    const bankName = String(row["Bank"] ?? "").trim();
    if (!serial || !bankName) {
      skipped++;
      continue;
    }

    const areaKey = await areaKeyFromLabel(areas, row["Area"]);
    const area = areas.find((a) => a.key === areaKey)!;

    let bank = await db.bank.findFirst({ where: { name: { equals: bankName, mode: "insensitive" } } });
    if (!bank) {
      const existingCount = await db.bank.count({ where: { areaId: area.id } });
      const perRow = Math.max(1, Math.floor((settings.mapWidth - 80) / (BANK_W + 30)));
      const col = existingCount % perRow;
      const gridRow = Math.floor(existingCount / perRow);
      const x = 40 + col * (BANK_W + 30);
      const y = area.y + 24 + gridRow * 190;
      bank = await db.bank.create({ data: { name: bankName, areaId: area.id, x, y, capacity: 1 } });
      banksCreated++;
    }

    const statusRaw = String(row["Compliance Status"] ?? "").trim().toLowerCase();
    const statusKey: ComplianceStatus =
      statusRaw === "verified" ? "VERIFIED" : statusRaw === "flagged" ? "FLAGGED" : "PENDING";

    const existing = await db.machine.findUnique({ where: { serial } });

    if (existing) {
      const data: Record<string, unknown> = {};
      if (row["Asset Number"]) data.assetNumber = String(row["Asset Number"]);
      if (row["Manufacturer"]) data.manufacturer = String(row["Manufacturer"]);
      if (row["Model"]) data.model = String(row["Model"]);
      if (row["Game Theme"]) data.theme = String(row["Game Theme"]);
      if (row["PAR Sheet"]) data.parSheet = String(row["PAR Sheet"]);
      if (row["Seal Number"] !== undefined && row["Seal Number"] !== "") data.sealNumber = String(row["Seal Number"]);
      if (row["Compliance Status"]) data.complianceStatus = statusKey;
      if (row["Software Status"]) data.softwareStatus = String(row["Software Status"]);
      if (row["Status Since"]) data.statusSince = new Date(String(row["Status Since"]));

      await db.machine.update({ where: { serial }, data });
      await db.machineHistory.create({ data: { machineId: existing.id, event: "Record updated via Excel import" } });

      if (existing.bankId !== bank.id) {
        const seatIndex = await placeMachineInSeat(bank.id, row["Seat"]);
        await db.machine.update({ where: { serial }, data: { bankId: bank.id, seatIndex } });
        await db.machineHistory.create({
          data: { machineId: existing.id, event: `Moved to ${bank.name} via Excel import` },
        });
      }
      updated++;
    } else {
      const seatIndex = await placeMachineInSeat(bank.id, row["Seat"]);
      await db.machine.create({
        data: {
          id: serial,
          serial,
          assetNumber: String(row["Asset Number"] ?? ""),
          manufacturer: String(row["Manufacturer"] ?? ""),
          model: String(row["Model"] ?? ""),
          theme: String(row["Game Theme"] ?? ""),
          parSheet: String(row["PAR Sheet"] ?? ""),
          sealNumber: String(row["Seal Number"] ?? ""),
          complianceStatus: statusKey,
          softwareStatus: String(row["Software Status"] || "Compliant"),
          statusSince: row["Status Since"] ? new Date(String(row["Status Since"])) : new Date(),
          bankId: bank.id,
          seatIndex,
          history: { create: [{ event: `Imported via Excel — added to ${bank.name}` }] },
        },
      });
      created++;
    }
  }

  await db.mapChangeLog.create({
    data: {
      changeType: "Import",
      bankName: banksCreated ? `${banksCreated} new bank(s)` : "—",
      areaLabel: "—",
      notes: `${created} machine(s) created, ${updated} updated${skipped ? `, ${skipped} row(s) skipped` : ""}`,
    },
  });

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");

  return { created, updated, banksCreated, skipped };
}
