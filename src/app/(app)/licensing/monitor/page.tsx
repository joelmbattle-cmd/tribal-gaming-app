import { getExpiringPeople, getExpiringVendorCompanies } from "@/lib/data/license-monitor";
import { LicenseMonitorView } from "@/components/views/license-monitor-view";

export default async function LicenseMonitorPage() {
  const [allPeople, allCompanies] = await Promise.all([getExpiringPeople(), getExpiringVendorCompanies()]);
  const companies = allCompanies.filter((c) => !c.name.includes("DO NOT USE"));
  const people = allPeople;

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
        status: c.status,
        licenseExpirationDate: c.licenseExpirationDate!.toISOString().slice(0, 10),
      }))}
    />
  );
}
