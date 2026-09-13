import { getPersonList } from "@/lib/data/people";
import { ProfileListView } from "@/components/views/profile-list-view";

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const people = await getPersonList(showArchived);
  return (
    <ProfileListView
      showArchived={showArchived}
      people={people.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        status: p.status,
        photoUrl: p.photoUrl,
        dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
        contactInfo: p.contactInfo,
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
        investigationCompletionDate: p.investigationCompletionDate ? p.investigationCompletionDate.toISOString().slice(0, 10) : null,
        keyFindings: p.keyFindings,
        createdBy: p.createdBy,
        lastModifiedBy: p.lastModifiedBy,
        archived: p.archived,
        archivedAt: p.archivedAt ? p.archivedAt.toISOString().slice(0, 10) : null,
        archivedBy: p.archivedBy,
        restoredAt: p.restoredAt ? p.restoredAt.toISOString().slice(0, 10) : null,
        restoredBy: p.restoredBy,
        documents: p.documents.map((d) => ({ id: d.id, name: d.name, date: d.date ? d.date.toISOString().slice(0, 10) : null })),
        history: p.history.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), event: h.event })),
      }))}
    />
  );
}
