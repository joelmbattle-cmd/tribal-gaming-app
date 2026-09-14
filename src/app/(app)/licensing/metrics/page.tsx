import { getLicensingMetricsData } from "@/lib/data/licensing-metrics";
import { LicensingMetricsView } from "@/components/views/licensing-metrics-view";
import type { LicensingMetricsPerson } from "@/lib/licensing-metrics";

function toISODate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function LicensingMetricsPage() {
  const people = await getLicensingMetricsData();

  const viewPeople: LicensingMetricsPerson[] = people.map((p) => ({
    id: p.id,
    vendorCompanyId: p.vendorCompanyId,
    applicationStatus: p.applicationStatus,
    applicationDate: toISODate(p.applicationDate),
    licenseIssueDate: toISODate(p.licenseIssueDate),
    investigationStartDate: toISODate(p.investigationStartDate),
    investigationCompletionDate: toISODate(p.investigationCompletionDate),
    licenseIssuanceDocDate: toISODate(p.documents.find((d) => d.slot === "LICENSE_ISSUANCE")?.date ?? null),
    separationNoticeDocDate: toISODate(p.documents.find((d) => d.slot === "SEPARATION_NOTICE")?.date ?? null),
  }));

  return <LicensingMetricsView people={viewPeople} />;
}
