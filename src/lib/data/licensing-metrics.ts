import { db } from "@/lib/db";

// Feeds the Licensing Metrics & Reporting page only — pulls Person fields
// plus the two document-checklist slots (License Issuance, Separation
// Notice) whose dates double as status-outcome event dates. No Compliance
// data (Machine/Exclusion) is queried here.
export async function getLicensingMetricsData() {
  return db.person.findMany({
    where: { archived: false },
    select: {
      id: true,
      vendorCompanyId: true,
      applicationStatus: true,
      applicationDate: true,
      licenseIssueDate: true,
      investigationStartDate: true,
      investigationCompletionDate: true,
      documents: {
        where: { slot: { in: ["LICENSE_ISSUANCE", "SEPARATION_NOTICE"] } },
        select: { slot: true, date: true },
      },
    },
  });
}
