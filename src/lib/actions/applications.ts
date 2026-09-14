"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import type { LicensingApplicationStatus } from "@/lib/licensing-status";
import { revalidatePath } from "next/cache";

export type ApplicationIntake = {
  name: string;
  email: string;
  role: string;
  dateOfBirth?: string; // yyyy-mm-dd from a date input
  contactInfo?: string;
  position?: string;
  jobDescription?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseIssueDate?: string;
  licenseExpirationDate?: string;
  applicationDate?: string;
  applicationStatus?: LicensingApplicationStatus;
  backgroundStatus?: string;
  suitabilityDetermination?: string;
  assignedInvestigator?: string;
  investigationStartDate?: string;
  investigationCompletionDate?: string;
  keyFindings?: string;
  vendorCompanyId?: string;
};

function toDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null;
}

export async function createApplicationAction(intake: ApplicationIntake) {
  const user = await requireRole("LICENSING");
  const application = await db.application.create({
    data: {
      progress: "Invited",
      name: intake.name,
      email: intake.email,
      role: intake.role,
      dateOfBirth: toDateOrNull(intake.dateOfBirth),
      contactInfo: intake.contactInfo || null,
      position: intake.position || null,
      jobDescription: intake.jobDescription || null,
      licenseType: intake.licenseType || null,
      licenseNumber: intake.licenseNumber || null,
      licenseIssueDate: toDateOrNull(intake.licenseIssueDate),
      licenseExpirationDate: toDateOrNull(intake.licenseExpirationDate),
      applicationDate: toDateOrNull(intake.applicationDate),
      applicationStatus: intake.applicationStatus || null,
      backgroundStatus: intake.backgroundStatus || null,
      suitabilityDetermination: intake.suitabilityDetermination || null,
      assignedInvestigator: intake.assignedInvestigator || null,
      investigationStartDate: toDateOrNull(intake.investigationStartDate),
      investigationCompletionDate: toDateOrNull(intake.investigationCompletionDate),
      keyFindings: intake.keyFindings || null,
      vendorCompanyId: intake.vendorCompanyId || null,
      invitedBy: user.name,
    },
  });
  revalidatePath("/licensing/applications");
  if (intake.vendorCompanyId) revalidatePath(`/licensing/vendors/${intake.vendorCompanyId}`);
  return application;
}

export async function markApplicationSubmittedAction(applicationId: string) {
  await requireRole("LICENSING");
  await db.application.update({
    where: { id: applicationId },
    data: { progress: "Submitted", submittedAt: new Date() },
  });
  revalidatePath("/licensing/applications");
}

export async function rejectApplicationAction(applicationId: string) {
  const user = await requireRole("LICENSING");
  const application = await db.application.update({
    where: { id: applicationId },
    data: { progress: "Rejected", rejectedAt: new Date(), rejectedBy: user.name },
  });
  revalidatePath("/licensing/applications");
  if (application.vendorCompanyId) revalidatePath(`/licensing/vendors/${application.vendorCompanyId}`);
}

// Accept: creates a licensee Person profile with every field carried over
// from the application as-is, links the two records, and — for a vendor
// principal's application — attaches the new profile to that company.
export async function acceptApplicationAction(applicationId: string) {
  const user = await requireRole("LICENSING");
  const application = await db.application.findUniqueOrThrow({ where: { id: applicationId } });

  const person = await db.person.create({
    data: {
      name: application.name,
      role: application.role,
      status: "investigation",
      dateOfBirth: application.dateOfBirth,
      contactInfo: application.contactInfo ?? (application.email || null),
      position: application.position,
      jobDescription: application.jobDescription,
      licenseType: application.licenseType,
      licenseNumber: application.licenseNumber,
      licenseIssueDate: application.licenseIssueDate,
      licenseExpirationDate: application.licenseExpirationDate,
      applicationDate: application.applicationDate,
      applicationStatus: application.applicationStatus,
      backgroundStatus: application.backgroundStatus,
      suitabilityDetermination: application.suitabilityDetermination,
      assignedInvestigator: application.assignedInvestigator,
      investigationStartDate: application.investigationStartDate,
      investigationCompletionDate: application.investigationCompletionDate,
      keyFindings: application.keyFindings,
      vendorCompanyId: application.vendorCompanyId,
      createdBy: user.name,
      lastModifiedBy: user.name,
      history: { create: [{ event: `Profile created from accepted application ${application.id}` }] },
    },
  });

  await db.application.update({
    where: { id: applicationId },
    data: { progress: "Accepted", acceptedAt: new Date(), acceptedBy: user.name, personId: person.id },
  });

  revalidatePath("/licensing/applications");
  revalidatePath("/licensing/profiles");
  if (application.vendorCompanyId) revalidatePath(`/licensing/vendors/${application.vendorCompanyId}`);
  return person;
}
