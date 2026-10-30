"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { logMapChange } from "@/lib/actions/floor";
import { boundsOf } from "@/lib/floor-plan/geometry";
import type { Pt } from "@/lib/floor-plan/geometry";
import {
  MAX_BANK_H,
  MANUAL_MIN_H,
  MANUAL_MIN_W,
  MAX_BANK_W,
  MIN_BANK_H,
  MIN_BANK_W,
  PLAN_PAD,
  validatePlanPayload,
} from "@/lib/floor-plan/types";
import type { Prisma } from "@/generated/prisma/client";

type InputJsonValue = Prisma.InputJsonValue;

const PLAN_ORIGIN_X = 40;
const AREA_GAP = 20; // matches the gap between the seeded areas

export type ApplyPlanResult = {
  planId: string;
  areaKey: string;
  created: number;
  updated: number;
  /** Banks that exist on the plan but were not in this drawing — left untouched. */
  missing: number;
  /** Labels that collided with an existing bank name and were suffixed. */
  renamed: string[];
};

/**
 * Creates (or updates) an imported CAD floor plan. Additive by design: a new
 * plan gets its own Area band *below* the existing areas, so the demo layout —
 * banks, machines, positions — is never touched. Updating an existing plan
 * only repositions/resizes that plan's own banks (matched by `cadRef`) and adds
 * new ones; banks no longer in the drawing are left in place, never deleted.
 */
export async function applyFloorPlanAction(input: unknown): Promise<ApplyPlanResult> {
  await requireRole("COMPLIANCE");
  const plan = validatePlanPayload(input);
  const outlineJson = plan.outline as unknown as InputJsonValue;

  const result = await db.$transaction(
    async (tx) => {
      const takenNames = new Set((await tx.bank.findMany({ select: { name: true } })).map((b) => b.name.toLowerCase()));
      const renamed: string[] = [];
      const uniqueName = (label: string) => {
        let name = label;
        for (let n = 2; takenNames.has(name.toLowerCase()); n++) name = `${label} (${n})`;
        if (name !== label) renamed.push(`${label} → ${name}`);
        takenNames.add(name.toLowerCase());
        return name;
      };

      const areaHeight = plan.height + PLAN_PAD * 2;
      let areaId: string;
      let areaKey: string;
      let areaLabel: string;
      let areaY: number;
      let planId: string;
      let created = 0;
      let updated = 0;
      let missing = 0;

      if (plan.targetPlanId) {
        const existing = await tx.floorPlan.findUnique({
          where: { id: plan.targetPlanId },
          include: { area: true, banks: true },
        });
        if (!existing) throw new Error("That floor plan no longer exists.");
        planId = existing.id;
        areaId = existing.areaId;
        areaKey = existing.area.key;
        areaLabel = existing.area.label;
        areaY = existing.area.y;

        // Resize the band; anything below shifts with it (same as Expand/Shrink Area).
        const delta = areaHeight - existing.area.h;
        if (delta !== 0) {
          const below = await tx.area.findMany({ where: { order: { gt: existing.area.order } } });
          for (const a of below) {
            await tx.area.update({ where: { id: a.id }, data: { y: a.y + delta } });
            await tx.bank.updateMany({ where: { areaId: a.id }, data: { y: { increment: delta } } });
          }
          await tx.area.update({ where: { id: areaId }, data: { h: areaHeight } });
        }
        await tx.floorPlan.update({
          where: { id: planId },
          data: {
            sourceFile: plan.sourceFile,
            units: plan.units,
            scale: plan.scale,
            width: plan.width,
            height: plan.height,
            outline: outlineJson,
          },
        });

        const byRef = new Map(existing.banks.filter((b) => b.cadRef).map((b) => [b.cadRef!, b]));
        const seen = new Set<string>();
        for (const b of plan.banks) {
          seen.add(b.ref);
          const geo = {
            x: PLAN_ORIGIN_X + b.x,
            y: areaY + PLAN_PAD + b.y,
            w: b.w,
            h: b.h,
            footprint: b.footprint as unknown as InputJsonValue,
          };
          const hit = byRef.get(b.ref);
          if (hit) {
            await tx.bank.update({ where: { id: hit.id }, data: geo });
            updated++;
          } else {
            await tx.bank.create({
              data: { ...geo, name: uniqueName(b.label), areaId, capacity: 1, planId, cadRef: b.ref },
            });
            created++;
          }
        }
        missing = existing.banks.filter((b) => b.cadRef && !seen.has(b.cadRef)).length;
      } else {
        const areas = await tx.area.findMany({ orderBy: { order: "asc" } });
        areaY = areas.reduce((m, a) => Math.max(m, a.y + a.h), 0) + (areas.length ? AREA_GAP : 0);
        const area = await tx.area.create({
          data: {
            key: `plan-${randomUUID().slice(0, 8)}`,
            label: plan.name,
            y: areaY,
            h: areaHeight,
            order: areas.reduce((m, a) => Math.max(m, a.order), -1) + 1,
          },
        });
        areaId = area.id;
        areaKey = area.key;
        areaLabel = area.label;
        const fp = await tx.floorPlan.create({
          data: {
            name: plan.name,
            sourceFile: plan.sourceFile,
            units: plan.units,
            scale: plan.scale,
            areaId,
            originX: PLAN_ORIGIN_X,
            width: plan.width,
            height: plan.height,
            outline: outlineJson,
          },
        });
        planId = fp.id;
        await tx.bank.createMany({
          data: plan.banks.map((b) => ({
            name: uniqueName(b.label),
            areaId,
            x: PLAN_ORIGIN_X + b.x,
            y: areaY + PLAN_PAD + b.y,
            capacity: 1,
            w: b.w,
            h: b.h,
            footprint: b.footprint as unknown as InputJsonValue,
            planId,
            cadRef: b.ref,
          })),
        });
        created = plan.banks.length;
      }

      // Make sure the canvas is wide enough for the plan.
      const settings = await tx.mapSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
      const needed = PLAN_ORIGIN_X + plan.width + 120;
      if (needed > settings.mapWidth) await tx.mapSettings.update({ where: { id: 1 }, data: { mapWidth: needed } });

      return { planId, areaKey, areaLabel, created, updated, missing, renamed };
    },
    { timeout: 60_000, maxWait: 15_000 },
  );

  const verb = plan.targetPlanId ? "Updated" : "Imported";
  await logMapChange(
    "CAD Import",
    `${result.created + result.updated} bank(s)`,
    result.areaLabel,
    `${verb} floor plan "${plan.name}"${plan.sourceFile ? ` from ${plan.sourceFile}` : ""} — ${result.created} bank(s) added` +
      (result.updated ? `, ${result.updated} repositioned` : "") +
      (result.missing ? `, ${result.missing} not in drawing (left as-is)` : ""),
  );

  revalidatePath("/compliance/floor");
  return {
    planId: result.planId,
    areaKey: result.areaKey,
    created: result.created,
    updated: result.updated,
    missing: result.missing,
    renamed: result.renamed,
  };
}

/**
 * Manual per-bank resize — the fallback when a CAD footprint needs a tweak.
 * Pass nulls to reset: banks with a CAD footprint snap back to a card that
 * covers the footprint; others return to the default card.
 */
export async function resizeBankAction(bankId: string, w: number | null, h: number | null) {
  await requireRole("COMPLIANCE");
  const bank = await db.bank.findUnique({ where: { id: bankId }, include: { area: true } });
  if (!bank) throw new Error("Bank not found");

  let nextW: number | null;
  let nextH: number | null;
  if (w == null || h == null) {
    const fp = Array.isArray(bank.footprint) ? (bank.footprint as unknown as Pt[]) : null;
    if (fp && fp.length >= 3) {
      const b = boundsOf(fp);
      nextW = Math.max(MIN_BANK_W, Math.ceil(b.maxX));
      nextH = Math.max(MIN_BANK_H, Math.ceil(b.maxY));
    } else {
      nextW = null;
      nextH = null;
    }
  } else {
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("Invalid size.");
    nextW = Math.round(Math.min(MAX_BANK_W, Math.max(MANUAL_MIN_W, w)));
    nextH = Math.round(Math.min(MAX_BANK_H, Math.max(MANUAL_MIN_H, h)));
  }

  await db.bank.update({ where: { id: bankId }, data: { w: nextW, h: nextH } });
  await logMapChange(
    "Resize Bank",
    bank.name,
    bank.area.label,
    nextW == null ? "Size reset to default" : `Resized to ${nextW} × ${nextH}px`,
  );
  revalidatePath("/compliance/floor");
  return { w: nextW, h: nextH };
}
