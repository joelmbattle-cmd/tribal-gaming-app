import { db } from "@/lib/db";

export async function getExclusionList() {
  return db.exclusion.findMany({
    orderBy: { enrolled: "desc" },
    include: { notes: { orderBy: { date: "asc" } } },
  });
}

export async function getExclusion(id: string) {
  return db.exclusion.findUnique({
    where: { id },
    include: { notes: { orderBy: { date: "asc" } } },
  });
}

export type ExclusionDetail = NonNullable<Awaited<ReturnType<typeof getExclusion>>>;
