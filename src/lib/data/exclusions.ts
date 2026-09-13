import { db } from "@/lib/db";

export async function getExclusionList(showArchived = false) {
  return db.exclusion.findMany({
    where: { archived: showArchived },
    orderBy: { enrolled: "desc" },
    include: { notes: { orderBy: { date: "asc" } }, documents: { orderBy: { date: "asc" } } },
  });
}

export async function getExclusion(id: string) {
  return db.exclusion.findUnique({
    where: { id },
    include: { notes: { orderBy: { date: "asc" } }, documents: { orderBy: { date: "asc" } } },
  });
}

export type ExclusionDetail = NonNullable<Awaited<ReturnType<typeof getExclusion>>>;
