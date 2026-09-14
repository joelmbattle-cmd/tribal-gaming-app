import { notFound } from "next/navigation";
import { getVendorCompany } from "@/lib/data/vendor-companies";
import { VendorCompanyDetailView } from "@/components/views/vendor-company-detail-view";

export default async function VendorCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ archived?: string }>;
}) {
  const { id } = await params;
  const { archived } = await searchParams;
  const company = await getVendorCompany(id);
  if (!company) notFound();

  const showArchived = archived === "1";

  return (
    <VendorCompanyDetailView
      company={{
        id: company.id,
        name: company.name,
        status: company.status,
        contactInfo: company.contactInfo,
        address: company.address,
        licenseType: company.licenseType,
        licenseNumber: company.licenseNumber,
        licenseIssueDate: company.licenseIssueDate ? company.licenseIssueDate.toISOString().slice(0, 10) : null,
        licenseExpirationDate: company.licenseExpirationDate
          ? company.licenseExpirationDate.toISOString().slice(0, 10)
          : null,
        archived: company.archived,
        archivedAt: company.archivedAt ? company.archivedAt.toISOString().slice(0, 10) : null,
        archivedBy: company.archivedBy,
        createdBy: company.createdBy,
        lastModifiedBy: company.lastModifiedBy,
      }}
      showArchivedPrincipals={showArchived}
      principals={company.principals
        .filter((p) => p.archived === showArchived)
        .map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          status: p.status,
          photoUrl: p.photoUrl,
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
          contactInfo: p.contactInfo,
          position: p.position,
          jobDescription: p.jobDescription,
          licenseType: p.licenseType,
          licenseNumber: p.licenseNumber,
          licenseIssueDate: p.licenseIssueDate ? p.licenseIssueDate.toISOString().slice(0, 10) : null,
          licenseExpirationDate: p.licenseExpirationDate ? p.licenseExpirationDate.toISOString().slice(0, 10) : null,
          applicationDate: p.applicationDate ? p.applicationDate.toISOString().slice(0, 10) : null,
          applicationStatus: p.applicationStatus,
          backgroundStatus: p.backgroundStatus,
          suitabilityDetermination: p.suitabilityDetermination,
          assignedInvestigator: p.assignedInvestigator,
          investigationStartDate: p.investigationStartDate ? p.investigationStartDate.toISOString().slice(0, 10) : null,
          investigationCompletionDate: p.investigationCompletionDate
            ? p.investigationCompletionDate.toISOString().slice(0, 10)
            : null,
          keyFindings: p.keyFindings,
          createdBy: p.createdBy,
          lastModifiedBy: p.lastModifiedBy,
          archived: p.archived,
          archivedAt: p.archivedAt ? p.archivedAt.toISOString().slice(0, 10) : null,
          archivedBy: p.archivedBy,
          restoredAt: p.restoredAt ? p.restoredAt.toISOString().slice(0, 10) : null,
          restoredBy: p.restoredBy,
          documents: p.documents.map((d) => ({
            id: d.id,
            name: d.name,
            date: d.date ? d.date.toISOString().slice(0, 10) : null,
            slot: d.slot,
            blobUrl: d.blobUrl,
          })),
          history: p.history.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), event: h.event })),
        }))}
      pendingApplications={company.applications
        .filter((a) => a.progress !== "Accepted" && a.progress !== "Rejected")
        .map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          progress: a.progress,
          invitedAt: a.invitedAt.toISOString().slice(0, 10),
        }))}
    />
  );
}
