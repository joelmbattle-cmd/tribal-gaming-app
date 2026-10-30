import type { LicensingMetrics } from "@/lib/licensing-metrics";

function cell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Licensing-only CSV: one row per metric for the selected period. */
export function licensingMetricsToCsv(m: LicensingMetrics, periodLabel: string): string {
  const rows: (string | number | null)[][] = [
    ["Period", "Section", "Metric", "Value"],
    [periodLabel, "Investigations", "Investigations Completed", m.investigationsCompleted],
    [periodLabel, "Investigations", "Vendor Principals Completed (with duration)", m.duration.vendor.count],
    [periodLabel, "Investigations", "Regular Licensees Completed (with duration)", m.duration.regular.count],
    [periodLabel, "Duration", "Avg Days — Vendor Principals", m.duration.vendor.avgDays],
    [periodLabel, "Duration", "Avg Days — Regular Licensees", m.duration.regular.avgDays],
    [periodLabel, "Outcomes", "Licensed", m.statusCounts.licensed],
    [periodLabel, "Outcomes", "Denied", m.statusCounts.denied],
    [periodLabel, "Outcomes", "Withdrew", m.statusCounts.withdrawn],
    [periodLabel, "Outcomes", "Separated", m.statusCounts.separated],
  ];
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvFilename(periodLabel: string): string {
  const slug = periodLabel.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `licensing-metrics-${slug || "period"}.csv`;
}
