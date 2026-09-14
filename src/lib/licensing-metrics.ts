import type { LicensingApplicationStatus } from "@/lib/licensing-status";

// Client-safe aggregation for the Licensing Metrics & Reporting page (R6/R8
// refinement) — deliberately separate from src/lib/data/metrics.ts, which
// still powers the shared Compliance+Licensing /metrics page. This module
// never touches Compliance data.

export type LicensingMetricsPerson = {
  id: string;
  // Set for a vendor company principal, null for a standalone/individual
  // licensee — the same distinction Person.vendorCompanyId already encodes.
  vendorCompanyId: string | null;
  applicationStatus: LicensingApplicationStatus | null;
  applicationDate: string | null; // YYYY-MM-DD
  licenseIssueDate: string | null;
  investigationStartDate: string | null;
  investigationCompletionDate: string | null;
  // Slot dates off the profile's document checklist — the most specific
  // "this event happened" signal available without a schema change.
  licenseIssuanceDocDate: string | null;
  separationNoticeDocDate: string | null;
};

export type LicensingPeriod = { start: Date; end: Date }; // end is exclusive

const LICENSED_STATUSES = new Set<LicensingApplicationStatus>(["APPROVED", "TEMPORARY_LICENSE", "LICENSED_WITH_CONDITIONS"]);

function parseDate(s: string | null): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

function inPeriod(d: Date | null, period: LicensingPeriod): boolean {
  return d !== null && d >= period.start && d < period.end;
}

/**
 * Best-available date a profile reached one of the four tracked outcomes.
 * Licensed uses the License Issuance document (falling back to the license's
 * issue date, then investigation completion, then application date); Denied
 * and Separated similarly prefer the most specific signal on file, falling
 * back to less specific ones so a demo/incomplete record still counts
 * somewhere rather than being silently dropped from every period.
 */
function statusEventDate(p: LicensingMetricsPerson): Date | null {
  if (p.applicationStatus && LICENSED_STATUSES.has(p.applicationStatus)) {
    return (
      parseDate(p.licenseIssuanceDocDate) ??
      parseDate(p.licenseIssueDate) ??
      parseDate(p.investigationCompletionDate) ??
      parseDate(p.applicationDate)
    );
  }
  if (p.applicationStatus === "DENIED") {
    return parseDate(p.investigationCompletionDate) ?? parseDate(p.applicationDate);
  }
  if (p.applicationStatus === "WITHDRAWN") {
    return parseDate(p.applicationDate);
  }
  if (p.applicationStatus === "SEPARATED") {
    return parseDate(p.separationNoticeDocDate) ?? parseDate(p.applicationDate);
  }
  return null;
}

function average(days: number[]): number | null {
  if (days.length === 0) return null;
  return Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
}

export type LicensingMetrics = {
  investigationsCompleted: number;
  duration: {
    vendor: { avgDays: number | null; count: number };
    regular: { avgDays: number | null; count: number };
  };
  statusCounts: { licensed: number; denied: number; withdrawn: number; separated: number };
};

export function computeLicensingMetrics(people: LicensingMetricsPerson[], period: LicensingPeriod): LicensingMetrics {
  let investigationsCompleted = 0;
  const vendorDurations: number[] = [];
  const regularDurations: number[] = [];
  let licensed = 0;
  let denied = 0;
  let withdrawn = 0;
  let separated = 0;

  for (const p of people) {
    const completion = parseDate(p.investigationCompletionDate);
    if (inPeriod(completion, period)) {
      investigationsCompleted++;
      const start = parseDate(p.investigationStartDate);
      if (start && completion) {
        const days = (completion.getTime() - start.getTime()) / 86400000;
        if (days >= 0) (p.vendorCompanyId ? vendorDurations : regularDurations).push(days);
      }
    }

    const eventDate = statusEventDate(p);
    if (inPeriod(eventDate, period)) {
      if (p.applicationStatus && LICENSED_STATUSES.has(p.applicationStatus)) licensed++;
      else if (p.applicationStatus === "DENIED") denied++;
      else if (p.applicationStatus === "WITHDRAWN") withdrawn++;
      else if (p.applicationStatus === "SEPARATED") separated++;
    }
  }

  return {
    investigationsCompleted,
    duration: {
      vendor: { avgDays: average(vendorDurations), count: vendorDurations.length },
      regular: { avgDays: average(regularDurations), count: regularDurations.length },
    },
    statusCounts: { licensed, denied, withdrawn, separated },
  };
}

export function monthPeriod(year: number, monthIndex0: number): LicensingPeriod {
  return { start: new Date(year, monthIndex0, 1), end: new Date(year, monthIndex0 + 1, 1) };
}

export function rangePeriod(fromISO: string, toISO: string): LicensingPeriod {
  const [from, to] = fromISO <= toISO ? [fromISO, toISO] : [toISO, fromISO];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
