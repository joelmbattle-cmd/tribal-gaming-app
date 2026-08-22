import { db } from "@/lib/db";
import { BANK_W } from "@/lib/floor-constants";

export async function getAreas() {
  return db.area.findMany({ orderBy: { order: "asc" } });
}

export async function getFloorMapData() {
  const [areas, banks, mapSettings] = await Promise.all([
    db.area.findMany({ orderBy: { order: "asc" } }),
    db.bank.findMany({
      include: { machines: { orderBy: { seatIndex: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    db.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
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
      seats,
    };
  });

  const maxExtent = banksOut.reduce((w, b) => Math.max(w, b.x + BANK_W + 400), 0);
  const mapWidth = Math.max(mapSettings.mapWidth, maxExtent);
  const mapHeight = areas.reduce((h, a) => Math.max(h, a.y + a.h), 0);

  return { areas, banks: banksOut, mapWidth, mapHeight };
}

export async function getMapChangeLog(limit = 8) {
  return db.mapChangeLog.findMany({ orderBy: { ts: "desc" }, take: limit });
}

export type FloorMapData = Awaited<ReturnType<typeof getFloorMapData>>;
export type FloorArea = FloorMapData["areas"][number];
export type FloorBank = FloorMapData["banks"][number];
export type FloorSeat = FloorBank["seats"][number];
