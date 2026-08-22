"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { uploadDocument } from "@/lib/blob";
import type { ComplianceStatus } from "@/generated/prisma/enums";

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  VERIFIED: "Verified",
  FLAGGED: "Flagged",
  PENDING: "Pending",
};

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
  const blobUrl = file ? await uploadDocument(file, `machines/${serial}`) : null;

  await db.$transaction([
    db.machineDocument.create({ data: { machineId: machine.id, name, blobUrl } }),
    db.machineHistory.create({ data: { machineId: machine.id, event: `Document attached: ${name}` } }),
  ]);

  revalidatePath("/compliance/floor");
  revalidatePath("/compliance/machines");
}
