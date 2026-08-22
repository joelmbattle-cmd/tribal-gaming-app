import { db } from "@/lib/db";

export async function getPersonList() {
  return db.person.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    include: { documents: { orderBy: { date: "asc" } }, history: { orderBy: { date: "asc" } } },
  });
}

export async function getPerson(id: string) {
  return db.person.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { date: "asc" } },
      history: { orderBy: { date: "asc" } },
    },
  });
}

export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPerson>>>;
