"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
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
  const company = await db.vendorCompany.create({
    data: {
      name: intake.name,
      status: intake.status,
      contactInfo: intake.contactInfo || null,
      address: intake.address || null,
      licenseType: intake.licenseType || null,
      licenseNumber: intake.licenseNumber || null,
      licenseIssueDate: toDateOrNull(intake.licenseIssueDate),
      licenseExpirationDate: toDateOrNull(intake.licenseExpirationDate),
      createdBy: user.name,
      lastModifiedBy: user.name,
    },
  });
  revalidatePath("/licensing/vendors");
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
