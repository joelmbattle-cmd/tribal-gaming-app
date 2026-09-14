import { db } from "@/lib/db";
import { EXPIRING_SOON_DAYS } from "@/lib/license-expiry";

function expiringCutoff(today: Date = new Date()): Date {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + EXPIRING_SOON_DAYS);
  return cutoff;
}

/**
 * Everyone whose license is already expired or due within EXPIRING_SOON_DAYS.
 * A single `lte` cutoff naturally covers both bands (and excludes rows with
 * no expiration date at all, since Prisma comparisons never match NULL).
 */
export async function getExpiringPeople() {
  return db.person.findMany({
    where: { archived: false, licenseExpirationDate: { lte: expiringCutoff() } },
    orderBy: { licenseExpirationDate: "asc" },
    include: { vendorCompany: { select: { id: true, name: true } } },
  });
}

export async function getExpiringVendorCompanies() {
  return db.vendorCompany.findMany({
    where: { archived: false, licenseExpirationDate: { lte: expiringCutoff() } },
    orderBy: { licenseExpirationDate: "asc" },
  });
}
