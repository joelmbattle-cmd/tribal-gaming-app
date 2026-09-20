"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { licensingStatusLabel } from "@/lib/licensing-status";

// Shared by the three Metrics & Reporting exports below (R8) — builds a
// Prisma DateTime filter from optional YYYY-MM-DD bounds, end-inclusive
// (matching the range semantics in src/lib/licensing-metrics.ts).
function dateRangeFilter(dateFrom?: string, dateTo?: string): { gte?: Date; lt?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const filter: { gte?: Date; lt?: Date } = {};
  if (dateFrom) filter.gte = new Date(`${dateFrom}T00:00:00`);
  if (dateTo) {
    const end = new Date(`${dateTo}T00:00:00`);
    end.setDate(end.getDate() + 1);
    filter.lt = end;
  }
  return filter;
}

export async function getMachineActivityHistoryExportAction(dateFrom?: string, dateTo?: string) {
  await requireRole("COMPLIANCE");
  const history = await db.machineHistory.findMany({
    where: { date: dateRangeFilter(dateFrom, dateTo) },
    include: { machine: { include: { bank: { include: { area: true } } } } },
    orderBy: { date: "desc" },
  });

  return history.map((h) => ({
    "Machine Serial": h.machine.serial,
    "Asset Number": h.machine.assetNumber,
    Area: h.machine.bank?.area.label ?? "",
    Bank: h.machine.bank?.name ?? "",
    Event: h.event,
    Date: h.date.toISOString().slice(0, 10),
  }));
}

export async function getLicensingCycleTimeExportAction(dateFrom?: string, dateTo?: string) {
  await requireRole("LICENSING");
  const completionFilter = { not: null, ...dateRangeFilter(dateFrom, dateTo) };
  const people = await db.person.findMany({
    where: {
      archived: false,
      investigationStartDate: { not: null },
      investigationCompletionDate: completionFilter,
    },
    include: { vendorCompany: { select: { name: true } } },
    orderBy: { investigationCompletionDate: "desc" },
  });

  return people.map((p) => {
    const start = p.investigationStartDate!;
    const completion = p.investigationCompletionDate!;
    const days = Math.round((completion.getTime() - start.getTime()) / 86400000);
    return {
      Case: p.name,
      "Vendor Company": p.vendorCompany?.name ?? "",
      "Application Status": licensingStatusLabel(p.applicationStatus),
      "Investigation Start": start.toISOString().slice(0, 10),
      "Investigation Completion": completion.toISOString().slice(0, 10),
      "Cycle Time (days)": days,
    };
  });
}

export async function getExclusionEnforcementLogExportAction(dateFrom?: string, dateTo?: string) {
  await requireRole("COMPLIANCE");
  const notes = await db.exclusionNote.findMany({
    where: { date: dateRangeFilter(dateFrom, dateTo) },
    include: { exclusion: true },
    orderBy: { date: "desc" },
  });

  return notes.map((n) => ({
    Person: n.exclusion.personName ?? "—",
    Status: n.exclusion.status,
    "Exclusion Type": n.exclusion.exclusionType ?? "",
    Event: n.event,
    Date: n.date.toISOString().slice(0, 10),
  }));
}
