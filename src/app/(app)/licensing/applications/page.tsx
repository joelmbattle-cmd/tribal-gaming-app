import { getApplicationList } from "@/lib/data/applications";
import { getVendorCompanyList } from "@/lib/data/vendor-companies";
import { ApplicationListView } from "@/components/views/application-list-view";

export default async function ApplicationsPage() {
  const [applications, companies] = await Promise.all([getApplicationList(), getVendorCompanyList(false)]);

  return (
    <ApplicationListView
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      applications={applications.map((a) => ({
        id: a.id,
        progress: a.progress,
        name: a.name,
        email: a.email,
        role: a.role,
        dateOfBirth: a.dateOfBirth ? a.dateOfBirth.toISOString().slice(0, 10) : null,
        contactInfo: a.contactInfo,
        position: a.position,
        jobDescription: a.jobDescription,
        licenseType: a.licenseType,
        licenseNumber: a.licenseNumber,
        licenseIssueDate: a.licenseIssueDate ? a.licenseIssueDate.toISOString().slice(0, 10) : null,
        licenseExpirationDate: a.licenseExpirationDate ? a.licenseExpirationDate.toISOString().slice(0, 10) : null,
        applicationDate: a.applicationDate ? a.applicationDate.toISOString().slice(0, 10) : null,
        applicationStatus: a.applicationStatus,
        backgroundStatus: a.backgroundStatus,
        suitabilityDetermination: a.suitabilityDetermination,
        assignedInvestigator: a.assignedInvestigator,
        investigationStartDate: a.investigationStartDate ? a.investigationStartDate.toISOString().slice(0, 10) : null,
        investigationCompletionDate: a.investigationCompletionDate
          ? a.investigationCompletionDate.toISOString().slice(0, 10)
          : null,
        keyFindings: a.keyFindings,
        vendorCompanyId: a.vendorCompanyId,
        vendorCompanyName: a.vendorCompany?.name ?? null,
        invitedBy: a.invitedBy,
        invitedAt: a.invitedAt.toISOString().slice(0, 10),
        submittedAt: a.submittedAt ? a.submittedAt.toISOString().slice(0, 10) : null,
        acceptedAt: a.acceptedAt ? a.acceptedAt.toISOString().slice(0, 10) : null,
        acceptedBy: a.acceptedBy,
        rejectedAt: a.rejectedAt ? a.rejectedAt.toISOString().slice(0, 10) : null,
        rejectedBy: a.rejectedBy,
        personId: a.personId,
        personName: a.person?.name ?? null,
      }))}
    />
  );
}
