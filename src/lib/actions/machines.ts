"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { uploadDocument } from "@/lib/blob";
import { addBankAction, logMapChange, nextBankPosition } from "@/lib/actions/floor";
import { placeMachineInSeat } from "@/lib/actions/import-export";
import { getAreas, getBankOptions } from "@/lib/data/floor";
import type { ComplianceStatus } from "@/generated/prisma/enums";

export type BankTarget = { bankId?: string; newBank?: { name: string; areaKey: string; capacity: number } };

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  VERIFIED: "Verified",
  FLAGGED: "Flagged",
  PENDING: "Pending",
};

export type NewMachineFields = {
  serial: string;
  assetNumber: string;
  manufacturer: string;
  model: string;
  theme: string;
  parSheet: string;
  sealNumber?: string;
} & BankTarget;

// New machines land on a shared "Unassigned" bank so they're visible on the
// Interactive Floor Map immediately — operators move them to a real bank
// afterward using the existing seat drag-and-drop flow. Picking a bank at
// creation time (below) skips this and seats the machine directly.
async function findOrCreateUnassignedBank() {
  const existing = await db.bank.findFirst({
    where: { name: { equals: "Unassigned", mode: "insensitive" } },
    include: { area: true },
  });
  if (existing) return existing;

  const areas = await db.area.findMany({ orderBy: { order: "asc" } });
  const areaKey = (areas.find((a) => a.key.toLowerCase() === "other") ?? areas[areas.length - 1]).key;
  const { x, y, area } = await nextBankPosition(areaKey);
  const bank = await db.bank.create({ data: { name: "Unassigned", areaId: area.id, x, y, capacity: 1 } });
  return { ...bank, area };
}

async function resolveTargetBank(target: BankTarget) {
  if (target.newBank) {
    const name = target.newBank.name.trim();
    if (!name) throw new Error("New bank name is required");
    return addBankAction(name, target.newBank.areaKey, target.newBank.capacity);
  }
  if (!target.bankId) return findOrCreateUnassignedBank();
  const bank = await db.bank.findUnique({ where: { id: target.bankId }, include: { area: true } });
  if (!bank) throw new Error("Selected bank not found");
  return bank;
}

export async function createMachineAction(fields: NewMachineFields) {
  await requireRole("COMPLIANCE");

  const serial = fields.serial.trim();
  const assetNumber = fields.assetNumber.trim();
  const manufacturer = fields.manufacturer.trim();
  const model = fields.model.trim();
  const theme = fields.theme.trim();
  const parSheet = fields.parSheet.trim();
  const sealNumber = (fields.sealNumber ?? "").trim();

  if (!serial || !assetNumber || !manufacturer || !model || !theme || !parSheet) {
    throw new Error("Serial number, asset number, manufacturer, model, game theme, and PAR sheet are required");
  }

  const existing = await db.machine.findUnique({ where: { serial } });
  if (existing) throw new Error(`A machine with serial ${serial} already exists`);

  const bank = await resolveTargetBank(fields);
  const seatIndex = await placeMachineInSeat(bank.id, undefined);

  await db.machine.create({
    data: {
      serial,
      assetNumber,
      manufacturer,
      model,
      theme,
      parSheet,
      sealNumber,
      bankId: bank.id,
      seatIndex,
      history: { create: [{ event: `Added via Machine Records — placed in ${bank.name}, Seat ${seatIndex + 1}` }] },
    },
  });

  await logMapChange("Add Machines", bank.name, bank.area.label, `${serial} added, Seat ${seatIndex + 1}`);

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
  revalidatePath("/compliance/software");
}

export async function getMachineDrawerDataAction(serial: string) {
  await requireRole("COMPLIANCE");
  const [m, banks, areas] = await Promise.all([
    db.machine.findUnique({
      where: { serial },
      include: {
        bank: true,
        documents: { orderBy: { date: "asc" } },
        history: { orderBy: { date: "desc" } },
      },
    }),
    getBankOptions(),
    getAreas(),
  ]);
  if (!m) return null;
  const priorBank = m.archived && m.priorBankId
    ? await db.bank.findUnique({ where: { id: m.priorBankId } })
    : null;
  return {
    serial: m.serial,
    bankId: m.bankId,
    bankName: m.archived ? "— Archived —" : (m.bank?.name ?? "Unassigned"),
    banks,
    areas,
    manufacturer: m.manufacturer,
    model: m.model,
    theme: m.theme,
    parSheet: m.parSheet,
    sealNumber: m.sealNumber,
    complianceStatus: m.complianceStatus,
    lifecycleStatus: m.lifecycleStatus,
    highlightFlag: m.highlightFlag,
    softwareStatus: m.softwareStatus,
    statusSince: m.statusSince.toISOString().slice(0, 10),
    archived: m.archived,
    archivedAt: m.archivedAt ? m.archivedAt.toISOString().slice(0, 10) : null,
    archivedBy: m.archivedBy,
    restoredAt: m.restoredAt ? m.restoredAt.toISOString().slice(0, 10) : null,
    restoredBy: m.restoredBy,
    priorBankName: priorBank?.name ?? null,
    documents: m.documents.map((d) => ({
      id: d.id,
      name: d.name,
      date: d.date.toISOString().slice(0, 10),
      blobUrl: d.blobUrl,
    })),
    history: m.history.map((h) => ({
      id: h.id,
      date: h.date.toISOString().slice(0, 10),
      event: h.event,
    })),
  };
}

export type MachineDrawerData = NonNullable<Awaited<ReturnType<typeof getMachineDrawerDataAction>>>;

export async function setMachineComplianceStatusAction(serial: string, status: ComplianceStatus) {
  await requireRole("COMPLIANCE");
  const machine = await db.machine.findUnique({ where: { serial } });
  if (!machine) throw new Error("Machine not found");
  if (machine.complianceStatus === status) return;

  await db.$transaction([
    db.machine.update({ where: { serial }, data: { complianceStatus: status } }),
    db.machineHistory.create({
      data: {
        machineId: machine.id,
        event: `Status changed from ${STATUS_LABEL[machine.complianceStatus]} to ${STATUS_LABEL[status]}`,
      },
    }),
  ]);

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
  revalidatePath("/compliance/software");
}

export async function updateMachineFieldsAction(
  serial: string,
  fields: { manufacturer: string; model: string; theme: string; parSheet: string; sealNumber: string },
) {
  await requireRole("COMPLIANCE");
  const machine = await db.machine.findUnique({ where: { serial } });
  if (!machine) throw new Error("Machine not found");

  const changed: string[] = [];
  const data: Record<string, string> = {};
  if (fields.manufacturer.trim() && fields.manufacturer !== machine.manufacturer) {
    data.manufacturer = fields.manufacturer.trim();
    changed.push("Manufacturer");
  }
  if (fields.model.trim() && fields.model !== machine.model) {
    data.model = fields.model.trim();
    changed.push("Model");
  }
  if (fields.theme.trim() && fields.theme !== machine.theme) {
    data.theme = fields.theme.trim();
    changed.push("Game Theme");
  }
  if (fields.parSheet.trim() && fields.parSheet !== machine.parSheet) {
    data.parSheet = fields.parSheet.trim();
    changed.push("PAR Sheet");
  }
  if (fields.sealNumber !== machine.sealNumber) {
    data.sealNumber = fields.sealNumber;
    changed.push("Seal Number");
  }

  if (changed.length === 0) return;

  await db.$transaction([
    db.machine.update({ where: { serial }, data }),
    db.machineHistory.create({
      data: { machineId: machine.id, event: `Record updated — ${changed.join(", ")} changed` },
    }),
  ]);

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
}

export async function updateMachineBankAction(serial: string, target: BankTarget) {
  await requireRole("COMPLIANCE");
  const machine = await db.machine.findUnique({ where: { serial } });
  if (!machine) throw new Error("Machine not found");

  const bank = await resolveTargetBank(target);
  if (bank.id === machine.bankId) return;

  const seatIndex = await placeMachineInSeat(bank.id, undefined);

  await db.$transaction([
    db.machine.update({ where: { serial }, data: { bankId: bank.id, seatIndex } }),
    db.machineHistory.create({
      data: { machineId: machine.id, event: `Reassigned to ${bank.name}, Seat ${seatIndex + 1}` },
    }),
  ]);

  await logMapChange("Move Bank", bank.name, bank.area.label, `${serial} reassigned to ${bank.name}, Seat ${seatIndex + 1}`);

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
  revalidatePath("/compliance/software");
}

export async function archiveMachineAction(serial: string) {
  const user = await requireRole("COMPLIANCE");
  const machine = await db.machine.findUnique({ where: { serial }, include: { bank: { include: { area: true } } } });
  if (!machine) throw new Error("Machine not found");
  if (machine.archived) return;

  await db.$transaction([
    db.machine.update({
      where: { serial },
      data: {
        archived: true,
        archivedAt: new Date(),
        archivedBy: user.name,
        priorBankId: machine.bankId,
        priorSeatIndex: machine.seatIndex,
        bankId: null,
        seatIndex: null,
      },
    }),
    db.machineHistory.create({
      data: {
        machineId: machine.id,
        event: machine.bank
          ? `Archived by ${user.name} — removed from ${machine.bank.name}, Seat ${(machine.seatIndex ?? 0) + 1}`
          : `Archived by ${user.name}`,
      },
    }),
  ]);

  if (machine.bank) {
    await logMapChange("Remove Machines", machine.bank.name, machine.bank.area.label, `${serial} archived and removed from floor`);
  }

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
  revalidatePath("/compliance/software");
}

export async function unarchiveMachineAction(serial: string) {
  const user = await requireRole("COMPLIANCE");
  const machine = await db.machine.findUnique({ where: { serial } });
  if (!machine) throw new Error("Machine not found");
  if (!machine.archived) return;

  const priorBank = machine.priorBankId
    ? await db.bank.findUnique({ where: { id: machine.priorBankId }, include: { area: true } })
    : null;
  const bank = priorBank ?? (await findOrCreateUnassignedBank());

  const seatIndex = await placeMachineInSeat(bank.id, undefined);

  await db.$transaction([
    db.machine.update({
      where: { serial },
      data: {
        archived: false,
        restoredAt: new Date(),
        restoredBy: user.name,
        bankId: bank.id,
        seatIndex,
        priorBankId: null,
        priorSeatIndex: null,
      },
    }),
    db.machineHistory.create({
      data: { machineId: machine.id, event: `Restored by ${user.name} — placed in ${bank.name}, Seat ${seatIndex + 1}` },
    }),
  ]);

  await logMapChange("Add Machines", bank.name, bank.area.label, `${serial} restored, Seat ${seatIndex + 1}`);

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
  revalidatePath("/compliance/software");
}

export async function attachMachineDocumentAction(serial: string, formData: FormData) {
  await requireRole("COMPLIANCE");
  const machine = await db.machine.findUnique({ where: { serial } });
  if (!machine) throw new Error("Machine not found");

  const file = formData.get("file") as File | null;
  const name = file && file.size > 0 ? file.name : `Field Note.pdf`;
  const upload = await uploadDocument(file, `machines/${serial}`);
  // Machines have always surfaced a genuine storage error to the user rather
  // than silently recording a document with no file; keep that.
  if (upload.status === "failed") throw new Error("Document upload failed");
  const blobUrl = upload.status === "uploaded" ? upload.url : null;

  await db.$transaction([
    db.machineDocument.create({ data: { machineId: machine.id, name, blobUrl } }),
    db.machineHistory.create({ data: { machineId: machine.id, event: `Document attached: ${name}` } }),
  ]);

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
}
