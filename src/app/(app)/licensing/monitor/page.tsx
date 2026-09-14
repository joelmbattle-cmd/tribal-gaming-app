import { getExpiringPeople, getExpiringVendorCompanies } from "@/lib/data/license-monitor";
import { LicenseMonitorView } from "@/components/views/license-monitor-view";

export default async function LicenseMonitorPage() {
  const [people, companies] = await Promise.all([getExpiringPeople(), getExpiringVendorCompanies()]);

  return (
    <LicenseMonitorView
      people={people.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        licenseExpirationDate: p.licenseExpirationDate!.toISOString().slice(0, 10),
        vendorCompanyId: p.vendorCompany?.id ?? null,
        vendorCompanyName: p.vendorCompany?.name ?? null,
      }))}
      companies={companies.map((c) => ({
        id: c.id,
        name: c.name,
        licenseExpirationDate: c.licenseExpirationDate!.toISOString().slice(0, 10),
      }))}
    />
  );
}
