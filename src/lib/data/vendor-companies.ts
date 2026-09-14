import { db } from "@/lib/db";

export async function getVendorCompanyList(showArchived = false) {
  return db.vendorCompany.findMany({
    where: { archived: showArchived },
    orderBy: { name: "asc" },
    include: {
      principals: { where: { archived: false } },
      applications: { where: { progress: { notIn: ["Accepted", "Rejected"] } } },
    },
  });
}

export async function getVendorCompany(id: string) {
  return db.vendorCompany.findUnique({
    where: { id },
    include: {
      principals: {
        orderBy: { name: "asc" },
        include: { documents: { orderBy: { date: "asc" } }, history: { orderBy: { date: "asc" } } },
      },
      applications: { orderBy: { invitedAt: "desc" } },
    },
  });
}

export type VendorCompanyDetail = NonNullable<Awaited<ReturnType<typeof getVendorCompany>>>;
