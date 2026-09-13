"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { uploadDocument } from "@/lib/blob";
import { addBankAction, logMapChange, nextBankPosition } from "@/lib/actions/floor";
import { placeMachineInSeat } from "@/lib/actions/import-export";
import type { ComplianceStatus } from "@/generated/prisma/enums";

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
  bankId?: string;
  newBank?: { name: string; areaKey: string; capacity: number };
};

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

async function resolveTargetBank(fields: NewMachineFields) {
  if (fields.newBank) {
    const name = fields.newBank.name.trim();
    if (!name) throw new Error("New bank name is required");
    return addBankAction(name, fields.newBank.areaKey, fields.newBank.capacity);
  }
  if (!fields.bankId) return findOrCreateUnassignedBank();
  const bank = await db.bank.findUnique({ where: { id: fields.bankId }, include: { area: true } });
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
  const m = await db.machine.findUnique({
    where: { serial },
    include: {
      bank: true,
      documents: { orderBy: { date: "asc" } },
      history: { orderBy: { date: "desc" } },
    },
  });
  if (!m) return null;
  return {
    serial: m.serial,
    bankName: m.bank?.name ?? "Unassigned",
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
