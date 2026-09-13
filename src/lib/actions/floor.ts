"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { BANK_W, EDGE_GROW, MAX_BANK_CAPACITY } from "@/lib/floor-constants";

async function areaForY(y: number) {
  const areas = await db.area.findMany({ orderBy: { order: "asc" } });
  const center = y + 40;
  for (const a of areas) {
    if (center >= a.y && center < a.y + a.h) return a;
  }
  return center < areas[0].y ? areas[0] : areas[areas.length - 1];
}

async function logMapChange(changeType: string, bankName: string, areaLabel: string, notes: string) {
  await db.mapChangeLog.create({ data: { changeType, bankName, areaLabel, notes } });
  const count = await db.mapChangeLog.count();
  if (count > 50) {
    const excess = await db.mapChangeLog.findMany({ orderBy: { ts: "asc" }, take: count - 50 });
    await db.mapChangeLog.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
  }
}

async function ensureCanvasFits(x: number, y: number) {
  const settings = await db.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (x + BANK_W + 160 > settings.mapWidth) {
    await db.mapSettings.update({ where: { id: 1 }, data: { mapWidth: x + BANK_W + 400 } });
  }
  const areas = await db.area.findMany({ orderBy: { order: "asc" } });
  const mapHeight = areas.reduce((h, a) => Math.max(h, a.y + a.h), 0);
  if (y + 220 > mapHeight) {
    const last = areas[areas.length - 1];
    await db.area.update({ where: { id: last.id }, data: { h: last.h + ((y + 300) - mapHeight) } });
  }
}

export async function moveMachineSlotAction(
  srcBankId: string,
  srcSeat: number,
  destBankId: string,
  destSeat: number,
) {
  await requireRole("COMPLIANCE");
  if (srcBankId === destBankId && srcSeat === destSeat) return;

  const [srcBank, destBank] = await Promise.all([
    db.bank.findUnique({ where: { id: srcBankId }, include: { machines: true } }),
    db.bank.findUnique({ where: { id: destBankId }, include: { machines: true } }),
  ]);
  if (!srcBank || !destBank) throw new Error("Bank not found");

  const moving = srcBank.machines.find((m) => m.seatIndex === srcSeat) ?? null;
  const occupying = destBank.machines.find((m) => m.seatIndex === destSeat) ?? null;

  await db.$transaction(async (tx) => {
    if (moving) await tx.machine.update({ where: { id: moving.id }, data: { bankId: null, seatIndex: null } });
    if (occupying) await tx.machine.update({ where: { id: occupying.id }, data: { bankId: null, seatIndex: null } });
    if (moving) {
      await tx.machine.update({ where: { id: moving.id }, data: { bankId: destBankId, seatIndex: destSeat } });
      await tx.machineHistory.create({
        data: { machineId: moving.id, event: `Moved to ${destBank.name}, Seat ${destSeat + 1}` },
      });
    }
    if (occupying) {
      await tx.machine.update({ where: { id: occupying.id }, data: { bankId: srcBankId, seatIndex: srcSeat } });
      await tx.machineHistory.create({
        data: { machineId: occupying.id, event: `Moved to ${srcBank.name}, Seat ${srcSeat + 1}` },
      });
    }
  });

  revalidatePath("/compliance/floor");
}

export async function setBankAreaAction(bankId: string, areaKey: string) {
  await requireRole("COMPLIANCE");
  const [bank, area] = await Promise.all([
    db.bank.findUnique({ where: { id: bankId } }),
    db.area.findUnique({ where: { key: areaKey } }),
  ]);
  if (!bank || !area) throw new Error("Not found");
  if (bank.areaId === area.id) return;
  await db.bank.update({ where: { id: bankId }, data: { areaId: area.id, y: area.y + 24 } });
  await logMapChange("Move Bank", bank.name, area.label, `Reassigned to ${area.label}`);
  revalidatePath("/compliance/floor");
}

export async function commitBankMoveAction(bankId: string, x: number, y: number) {
  await requireRole("COMPLIANCE");
  const bank = await db.bank.findUnique({ where: { id: bankId } });
  if (!bank) throw new Error("Not found");
  const clampedX = Math.max(0, x);
  const clampedY = Math.max(0, y);
  const newArea = await areaForY(clampedY);
  const areaChanged = newArea.id !== bank.areaId;

  await db.bank.update({ where: { id: bankId }, data: { x: clampedX, y: clampedY, areaId: newArea.id } });
  await ensureCanvasFits(clampedX, clampedY);

  await logMapChange(
    "Move Bank",
    bank.name,
    newArea.label,
    areaChanged ? `Moved into ${newArea.label}` : `Repositioned within ${newArea.label}`,
  );
  revalidatePath("/compliance/floor");
}

export async function changeBankCapacityAction(bankId: string, delta: number) {
  await requireRole("COMPLIANCE");
  const bank = await db.bank.findUnique({ where: { id: bankId }, include: { machines: true, area: true } });
  if (!bank) throw new Error("Not found");

  if (delta > 0) {
    if (bank.capacity >= MAX_BANK_CAPACITY) return;
    await db.bank.update({ where: { id: bankId }, data: { capacity: bank.capacity + 1 } });
    await logMapChange("Add Machines", bank.name, bank.area.label, `Capacity increased to ${bank.capacity + 1}`);
  } else {
    if (bank.capacity <= 1) return;
    const lastSeatOccupied = bank.machines.some((m) => m.seatIndex === bank.capacity - 1);
    if (lastSeatOccupied) {
      throw new Error("Move or remove the machine in the last seat before shrinking capacity.");
    }
    await db.bank.update({ where: { id: bankId }, data: { capacity: bank.capacity - 1 } });
    await logMapChange("Remove Machines", bank.name, bank.area.label, `Capacity decreased to ${bank.capacity - 1}`);
  }
  revalidatePath("/compliance/floor");
}

async function nextBankPosition(areaKey: string) {
  const area = await db.area.findUnique({ where: { key: areaKey } });
  if (!area) throw new Error("Area not found");
  const existing = await db.bank.count({ where: { areaId: area.id } });
  const settings = await db.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const perRow = Math.max(1, Math.floor((settings.mapWidth - 80) / (BANK_W + 30)));
  const col = existing % perRow;
  const row = Math.floor(existing / perRow);
  const x = 40 + col * (BANK_W + 30);
  const y = area.y + 24 + row * 190;
  await ensureCanvasFits(x, y);
  return { x, y, area };
}

export async function addBankAction(name: string, areaKey: string, capacity: number) {
  await requireRole("COMPLIANCE");
  const cap = Math.max(1, Math.min(MAX_BANK_CAPACITY, capacity || 4));
  const { x, y, area } = await nextBankPosition(areaKey);
  const bank = await db.bank.create({
    data: { name: name.trim() || "New Bank", areaId: area.id, x, y, capacity: cap },
  });
  await logMapChange("Other", bank.name, area.label, `New bank created in ${area.label}`);
  revalidatePath("/compliance/floor");
}

export async function growMapWidthAction(amount: number = EDGE_GROW) {
  await requireRole("COMPLIANCE");
  const settings = await db.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await db.mapSettings.update({ where: { id: 1 }, data: { mapWidth: settings.mapWidth + amount } });
  revalidatePath("/compliance/floor");
}

export async function growZoneHeightAction(areaKey: string, amount: number = EDGE_GROW * 0.7) {
  await requireRole("COMPLIANCE");
  const area = await db.area.findUnique({ where: { key: areaKey } });
  if (!area) throw new Error("Not found");
  const grow = Math.round(amount);
  const areasBelow = await db.area.findMany({ where: { order: { gt: area.order } } });

  await db.$transaction(async (tx) => {
    await tx.area.update({ where: { id: area.id }, data: { h: area.h + grow } });
    for (const below of areasBelow) {
      await tx.area.update({ where: { id: below.id }, data: { y: below.y + grow } });
      await tx.bank.updateMany({ where: { areaId: below.id }, data: { y: { increment: grow } } });
    }
  });

  revalidatePath("/compliance/floor");
}

export async function renameAreaAction(areaKey: string, label: string) {
  await requireRole("COMPLIANCE");
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Area name cannot be empty");
  const area = await db.area.findUnique({ where: { key: areaKey } });
  if (!area) throw new Error("Not found");
  if (trimmed === area.label) return;
  await db.area.update({ where: { id: area.id }, data: { label: trimmed } });
  await logMapChange("Other", "Area", trimmed, `Renamed "${area.label}" to "${trimmed}"`);
  revalidatePath("/compliance/floor");
}
