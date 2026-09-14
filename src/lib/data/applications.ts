import { db } from "@/lib/db";

export async function getApplicationList() {
  return db.application.findMany({
    orderBy: { invitedAt: "desc" },
    include: { vendorCompany: true, person: true },
  });
}

export type ApplicationListItem = Awaited<ReturnType<typeof getApplicationList>>[number];
