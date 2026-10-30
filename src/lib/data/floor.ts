import { db } from "@/lib/db";
import { BANK_W } from "@/lib/floor-constants";
import { PLAN_PAD } from "@/lib/floor-plan/types";
import { isFinitePt } from "@/lib/floor-plan/geometry";
import type { Pt } from "@/lib/floor-plan/geometry";

function asRing(v: unknown): Pt[] | null {
  return Array.isArray(v) && v.length >= 3 && v.every(isFinitePt) ? (v as Pt[]) : null;
}

export async function getAreas() {
  return db.area.findMany({ orderBy: { order: "asc" } });
}

export async function getFloorMapData() {
  const [areas, banks, mapSettings, planRows] = await Promise.all([
    db.area.findMany({ orderBy: { order: "asc" } }),
    db.bank.findMany({
      include: { machines: { orderBy: { seatIndex: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    db.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    db.floorPlan.findMany({ include: { area: true, _count: { select: { banks: true } } }, orderBy: { createdAt: "asc" } }),
  ]);

  const banksOut = banks.map((b) => {
    const seats = Array.from({ length: b.capacity }, (_, i) => {
      const m = b.machines.find((mm) => mm.seatIndex === i);
      return m
        ? { id: m.id, serial: m.serial, model: m.model, complianceStatus: m.complianceStatus }
        : null;
    });
    return {
      id: b.id,
      name: b.name,
      areaId: b.areaId,
      x: b.x,
      y: b.y,
      capacity: b.capacity,
      // Null = default card (every pre-existing bank); set by CAD import / manual resize.
      w: b.w,
      h: b.h,
      footprint: asRing(b.footprint),
      seats,
    };
  });

  const plans = planRows.map((p) => ({
    id: p.id,
    name: p.name,
    sourceFile: p.sourceFile,
    units: p.units,
    areaKey: p.area.key,
    // Canvas position of the plan's drawing origin (outline is relative to it).
    originX: p.originX,
    originY: p.area.y + PLAN_PAD,
    width: p.width,
    height: p.height,
    bankCount: p._count.banks,
    outline: (Array.isArray(p.outline) ? (p.outline as unknown[]) : []).map(asRing).filter((r): r is Pt[] => !!r),
  }));

  const maxExtent = banksOut.reduce((w, b) => Math.max(w, b.x + (b.w ?? BANK_W) + 400), 0);
  const mapWidth = Math.max(mapSettings.mapWidth, maxExtent);
  const mapHeight = areas.reduce((h, a) => Math.max(h, a.y + a.h), 0);

  return { areas, banks: banksOut, plans, mapWidth, mapHeight };
}

export async function getMapChangeLog(limit = 8) {
  return db.mapChangeLog.findMany({ orderBy: { ts: "desc" }, take: limit });
}

export async function getBankOptions() {
  const banks = await db.bank.findMany({
    include: { machines: true, area: true },
    orderBy: { name: "asc" },
  });
  return banks.map((b) => ({
    id: b.id,
    name: b.name,
    areaLabel: b.area.label,
    capacity: b.capacity,
    occupied: b.machines.filter((m) => m.seatIndex !== null).length,
    // CAD-imported banks may be matched by a bare tag ("104"); others by full name only.
    tagMatch: b.planId !== null,
  }));
}

export type BankOption = Awaited<ReturnType<typeof getBankOptions>>[number];

export type FloorMapData = Awaited<ReturnType<typeof getFloorMapData>>;
export type FloorArea = FloorMapData["areas"][number];
export type FloorBank = FloorMapData["banks"][number];
export type FloorSeat = FloorBank["seats"][number];
export type FloorPlanView = FloorMapData["plans"][number];
