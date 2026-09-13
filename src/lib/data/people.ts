import { db } from "@/lib/db";

export async function getPersonList(showArchived = false) {
  return db.person.findMany({
    where: { archived: showArchived },
    orderBy: { name: "asc" },
    include: { documents: { orderBy: { date: "asc" } }, history: { orderBy: { date: "asc" } } },
  });
}

export async function getPerson(id: string) {
  return db.person.findUnique({
    // Archived profiles are excluded here too, so an archived applicant loses
    // access to their own portal view rather than keeping a live record the
    // Licensing roster no longer shows.
    where: { id, archived: false },
    include: {
      documents: { orderBy: { date: "asc" } },
      history: { orderBy: { date: "asc" } },
    },
  });
}

export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPerson>>>;
