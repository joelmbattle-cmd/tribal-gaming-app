import { getVendorCompanyList } from "@/lib/data/vendor-companies";
import { VendorCompanyListView } from "@/components/views/vendor-company-list-view";

export default async function VendorLicensingPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const companies = await getVendorCompanyList(showArchived);
  return (
    <VendorCompanyListView
      showArchived={showArchived}
      companies={companies.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        contactInfo: c.contactInfo,
        address: c.address,
        licenseType: c.licenseType,
        licenseNumber: c.licenseNumber,
        licenseIssueDate: c.licenseIssueDate ? c.licenseIssueDate.toISOString().slice(0, 10) : null,
        licenseExpirationDate: c.licenseExpirationDate ? c.licenseExpirationDate.toISOString().slice(0, 10) : null,
        archived: c.archived,
        archivedAt: c.archivedAt ? c.archivedAt.toISOString().slice(0, 10) : null,
        archivedBy: c.archivedBy,
        principalCount: c.principals.length,
        pendingApplicationCount: c.applications.length,
      }))}
    />
  );
}
