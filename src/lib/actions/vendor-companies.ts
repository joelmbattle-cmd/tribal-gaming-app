"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { resolveLicenseExpiration } from "@/lib/license-expiry";
import { revalidatePath } from "next/cache";

export type VendorCompanyIntake = {
  name: string;
  status: string;
  contactInfo?: string;
  address?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseIssueDate?: string; // yyyy-mm-dd from a date input
  licenseExpirationDate?: string;
};

function toDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null;
}

export async function createVendorCompanyAction(intake: VendorCompanyIntake) {
  const user = await requireRole("LICENSING");
  const licenseIssueDate = toDateOrNull(intake.licenseIssueDate);
  // Renewal timeline (License Monitor): once a company's license is issued,
  // default its expiration to +2 years unless the approver typed a specific
  // one — any explicit value here always wins, of any length.
  const licenseExpirationDate = resolveLicenseExpiration(licenseIssueDate, toDateOrNull(intake.licenseExpirationDate));
  const company = await db.vendorCompany.create({
    data: {
      name: intake.name,
      status: intake.status,
      contactInfo: intake.contactInfo || null,
      address: intake.address || null,
      licenseType: intake.licenseType || null,
      licenseNumber: intake.licenseNumber || null,
      licenseIssueDate,
      licenseExpirationDate,
      createdBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/licensing/vendors");
  return company;
}

export async function updateVendorCompanyAction(companyId: string, intake: VendorCompanyIntake) {
  const user = await requireRole("LICENSING");

  // Archived companies are view-only, mirroring the same guard on
  // updatePersonAction — a stale drawer or a crafted request can't edit a
  // closed company record.
  const existing = await db.vendorCompany.findUnique({ where: { id: companyId }, select: { archived: true } });
  if (!existing) throw new Error("Vendor company not found");
  if (existing.archived) throw new Error("Cannot edit an archived vendor company");

  const licenseIssueDate = toDateOrNull(intake.licenseIssueDate);
  const licenseExpirationDate = resolveLicenseExpiration(licenseIssueDate, toDateOrNull(intake.licenseExpirationDate));

  const company = await db.vendorCompany.update({
    where: { id: companyId },
    data: {
      name: intake.name,
      status: intake.status,
      contactInfo: intake.contactInfo || null,
      address: intake.address || null,
      licenseType: intake.licenseType || null,
      licenseNumber: intake.licenseNumber || null,
      licenseIssueDate,
      licenseExpirationDate,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/licensing/vendors");
  revalidatePath(`/licensing/vendors/${companyId}`);
  return company;
}

export async function archiveVendorCompanyAction(companyId: string) {
  const user = await requireRole("LICENSING");
  await db.vendorCompany.update({
    where: { id: companyId },
    data: { archived: true, archivedAt: new Date(), archivedBy: user.name, lastModifiedBy: user.name },
  });
  revalidatePath("/licensing/vendors");
  revalidatePath(`/licensing/vendors/${companyId}`);
}

export async function unarchiveVendorCompanyAction(companyId: string) {
  const user = await requireRole("LICENSING");
  await db.vendorCompany.update({
    where: { id: companyId },
    data: { archived: false, restoredAt: new Date(), restoredBy: user.name, lastModifiedBy: user.name },
  });
  revalidatePath("/licensing/vendors");
  revalidatePath(`/licensing/vendors/${companyId}`);
}
