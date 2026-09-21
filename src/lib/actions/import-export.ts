"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { BANK_W } from "@/lib/floor-constants";
import { ASSIGN_CREATE, ASSIGN_SKIP, buildBankMatcher, normalizeBankName } from "@/lib/floor-plan/bank-match";
import type { ComplianceStatus, LifecycleStatus } from "@/generated/prisma/enums";
import type { Bank } from "@/generated/prisma/client";

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

/** Sanity cap on "grow the bank to fit Seat N" so a typo can't create a 10,000-seat bank. */
const MAX_SEAT_GROWTH = 64;

export async function placeMachineInSeat(
  bankId: string,
  seatRaw: unknown,
  opts: { growToSeat?: boolean } = {},
): Promise<number> {
  const bank = await db.bank.findUnique({ where: { id: bankId }, include: { machines: true } });
  if (!bank) throw new Error("Bank not found");
  const occupied = new Set(bank.machines.map((m) => m.seatIndex).filter((i): i is number => i !== null));

  const seatIdx = parseInt(String(seatRaw ?? ""), 10);
  if (!isNaN(seatIdx) && seatIdx >= 1 && seatIdx <= bank.capacity && !occupied.has(seatIdx - 1)) {
    return seatIdx - 1;
  }
  // Floor setup: a spreadsheet that says "Seat 6" means seat 6, so widen the
  // bank rather than falling back to the next open seat and losing the order.
  if (opts.growToSeat && !isNaN(seatIdx) && seatIdx > bank.capacity && seatIdx <= MAX_SEAT_GROWTH) {
    await db.bank.update({ where: { id: bankId }, data: { capacity: seatIdx } });
    return seatIdx - 1;
  }
  for (let i = 0; i < bank.capacity; i++) {
    if (!occupied.has(i)) return i;
  }
  await db.bank.update({ where: { id: bankId }, data: { capacity: bank.capacity + 1 } });
  return bank.capacity;
}

const LIFECYCLE_LOOKUP: Record<string, LifecycleStatus> = {
  active: "ACTIVE",
  "in transit": "IN_TRANSIT",
  transit: "IN_TRANSIT",
  "out of service": "OUT_OF_SERVICE",
  oos: "OUT_OF_SERVICE",
  converted: "CONVERTED",
  retired: "RETIRED",
};

function parseLifecycle(raw: unknown): LifecycleStatus | null {
  return LIFECYCLE_LOOKUP[String(raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ")] ?? null;
}

/** ISO / US-style strings, JS Dates, and Excel serial day numbers. Null when unusable (never an Invalid Date). */
function parseImportDate(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  let d: Date;
  if (raw instanceof Date) d = raw;
  else if (typeof raw === "number" || /^\d{5,6}(\.\d+)?$/.test(String(raw).trim())) {
    const n = Number(raw);
    // Excel serial day (1900 date system) → epoch.
    d = n > 20000 && n < 80000 ? new Date(Math.round((n - 25569) * 86400 * 1000)) : new Date(NaN);
  } else d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

export type ImportOptions = {
  /** Also match a bare tag ("104" / "Bank 104") to a single CAD-imported bank. Off = legacy exact-name match. */
  fuzzyBankMatch?: boolean;
  /** Honour Seat numbers above the bank's current capacity by widening the bank. */
  growToSeat?: boolean;
  /** Bank text not found on the map: create it (legacy default) or skip the row. */
  unmatchedBanks?: "create" | "skip";
  /** Per-value overrides from the mapping UI: Excel bank text → bank id, "__skip__" or "__create__". */
  bankAssignments?: Record<string, string>;
  /** Shown in the audit entry, e.g. "rows 301–600". */
  chunkLabel?: string;
};

export async function importMachinesAction(rows: ImportRow[], opts: ImportOptions = {}) {
  await requireRole("COMPLIANCE");
  const areas = await db.area.findMany({ orderBy: { order: "asc" } });
  const settings = await db.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const matcher = opts.fuzzyBankMatch
    ? buildBankMatcher((await db.bank.findMany({ select: { id: true, name: true, planId: true }, orderBy: { createdAt: "asc" } })).map((b) => ({ id: b.id, name: b.name, tagMatch: b.planId !== null })))
    : null;
  // Banks created (or looked up) during this call, keyed by normalised name.
  const bankCache = new Map<string, Bank>();
  const unmatched = new Set<string>();

  async function resolveBank(text: string): Promise<Bank | null> {
    const assigned = opts.bankAssignments?.[text];
    if (assigned === ASSIGN_SKIP) return null;
    if (assigned && assigned !== ASSIGN_CREATE) return db.bank.findUnique({ where: { id: assigned } });
    const key = normalizeBankName(text);
    const cached = bankCache.get(key);
    if (cached) return cached;
    if (matcher) {
      const hit = matcher(text);
      if (hit) {
        const found = await db.bank.findUnique({ where: { id: hit.id } });
        if (found) bankCache.set(key, found);
        return found;
      }
    }
    return db.bank.findFirst({ where: { name: { equals: text, mode: "insensitive" } } });
  }

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

    let bank = await resolveBank(bankName);
    if (!bank) {
      const explicitCreate = opts.bankAssignments?.[bankName] === ASSIGN_CREATE;
      if ((opts.unmatchedBanks === "skip" && !explicitCreate) || opts.bankAssignments?.[bankName] === ASSIGN_SKIP) {
        unmatched.add(bankName);
        skipped++;
        continue;
      }
      const areaKey = await areaKeyFromLabel(areas, row["Area"]);
      const area = areas.find((a) => a.key === areaKey)!;
      const existingCount = await db.bank.count({ where: { areaId: area.id } });
      const perRow = Math.max(1, Math.floor((settings.mapWidth - 80) / (BANK_W + 30)));
      const col = existingCount % perRow;
      const gridRow = Math.floor(existingCount / perRow);
      const x = 40 + col * (BANK_W + 30);
      const y = area.y + 24 + gridRow * 190;
      bank = await db.bank.create({ data: { name: bankName, areaId: area.id, x, y, capacity: 1 } });
      bankCache.set(normalizeBankName(bankName), bank);
      banksCreated++;
    }

    const statusRaw = String(row["Compliance Status"] ?? "").trim().toLowerCase();
    const statusKey: ComplianceStatus =
      statusRaw === "verified" ? "VERIFIED" : statusRaw === "flagged" ? "FLAGGED" : "PENDING";
    const lifecycle = parseLifecycle(row["Lifecycle Status"]);
    const statusSince = parseImportDate(row["Status Since"]);
    const seatOpts = { growToSeat: opts.growToSeat };

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
      if (statusSince) data.statusSince = statusSince;
      if (lifecycle) data.lifecycleStatus = lifecycle;

      await db.machine.update({ where: { serial }, data });
      await db.machineHistory.create({ data: { machineId: existing.id, event: "Record updated via Excel import" } });

      if (existing.bankId !== bank.id) {
        const seatIndex = await placeMachineInSeat(bank.id, row["Seat"], seatOpts);
        await db.machine.update({ where: { serial }, data: { bankId: bank.id, seatIndex } });
        await db.machineHistory.create({
          data: { machineId: existing.id, event: `Moved to ${bank.name} via Excel import` },
        });
      }
      updated++;
    } else {
      const seatIndex = await placeMachineInSeat(bank.id, row["Seat"], seatOpts);
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
          ...(lifecycle ? { lifecycleStatus: lifecycle } : {}),
          softwareStatus: String(row["Software Status"] || "Compliant"),
          statusSince: statusSince ?? new Date(),
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
      notes:
        `${opts.chunkLabel ? `${opts.chunkLabel}: ` : ""}${created} machine(s) created, ${updated} updated` +
        (skipped ? `, ${skipped} row(s) skipped` : ""),
    },
  });

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");

  return { created, updated, banksCreated, skipped, unmatched: [...unmatched] };
}
