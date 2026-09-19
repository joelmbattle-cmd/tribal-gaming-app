"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { exportRowsToExcel } from "@/lib/excel-client";
import {
  getMachineActivityHistoryExportAction,
  getLicensingCycleTimeExportAction,
  getExclusionEnforcementLogExportAction,
} from "@/lib/actions/reports";
import type { Role } from "@/generated/prisma/enums";

type ReportKey = "machines" | "licensing" | "exclusions";

const REPORTS: Record<
  ReportKey,
  {
    label: string;
    role: Role;
    filenamePrefix: string;
    sheetName: string;
    action: (dateFrom?: string, dateTo?: string) => Promise<Record<string, unknown>[]>;
  }
> = {
  machines: {
    label: "Machine activity history — full audit trail",
    role: "COMPLIANCE",
    filenamePrefix: "machine-activity-history",
    sheetName: "Machine Activity History",
    action: getMachineActivityHistoryExportAction,
  },
  licensing: {
    label: "Licensing cycle time by case",
    role: "LICENSING",
    filenamePrefix: "licensing-cycle-time",
    sheetName: "Licensing Cycle Time",
    action: getLicensingCycleTimeExportAction,
  },
  exclusions: {
    label: "Self-exclusion enforcement log",
    role: "COMPLIANCE",
    filenamePrefix: "self-exclusion-enforcement-log",
    sheetName: "Enforcement Log",
    action: getExclusionEnforcementLogExportAction,
  },
};

export function MetricsView({
  avgVerifyDays,
  openExceptions,
  auditReadiness,
  totalMachines,
  licensingBacklogCount,
  avgBacklogDays,
  clearedProfiles,
  totalProfiles,
  activeExclusions,
  totalExclusions,
  role,
}: {
  avgVerifyDays: number;
  openExceptions: number;
  auditReadiness: number;
  totalMachines: number;
  licensingBacklogCount: number;
  avgBacklogDays: number;
  clearedProfiles: number;
  totalProfiles: number;
  activeExclusions: number;
  totalExclusions: number;
  role: Role;
}) {
  const showToast = useToast();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pending, startTransition] = useTransition();
  const [pendingReport, setPendingReport] = useState<ReportKey | null>(null);

  const doExport = (key: ReportKey) => {
    const report = REPORTS[key];
    setPendingReport(key);
    startTransition(async () => {
      try {
        const rows = await report.action(dateFrom || undefined, dateTo || undefined);
        const ok = exportRowsToExcel(rows, report.filenamePrefix, report.sheetName);
        showToast(ok ? `Exported ${rows.length} record${rows.length === 1 ? "" : "s"} to Excel` : "No records to export for the selected range");
      } catch {
        showToast("You don't have access to export this report");
      } finally {
        setPendingReport(null);
      }
    });
  };

  return (
    <div>
      <div className="view-title">Metrics &amp; Reporting</div>
      <div className="view-sub">Audit-readiness views for Compliance, Licensing, and Self-Exclusion operations.</div>

      <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Compliance Metrics</div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{avgVerifyDays}d</div>
          <div className="metric-label">Avg. Time-to-Verify</div>
          <div className="metric-sub">EGD install to seal verification</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{openExceptions}</div>
          <div className="metric-label">Open Compliance Exceptions</div>
          <div className="metric-sub">Machines currently flagged</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{auditReadiness}%</div>
          <div className="metric-label">Audit Readiness</div>
          <div className="metric-sub">Machine records with complete documents</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{totalMachines}</div>
          <div className="metric-label">Total Machines</div>
          <div className="metric-sub">EGDs in system</div>
        </div>
      </div>

      <div className="section-label">Licensing Metrics</div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{licensingBacklogCount}</div>
          <div className="metric-label">Licensing Backlog</div>
          <div className="metric-sub">Open applications</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{avgBacklogDays}d</div>
          <div className="metric-label">Avg. Backlog Age</div>
          <div className="metric-sub">Days in investigation</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{clearedProfiles}</div>
          <div className="metric-label">Cleared Profiles</div>
          <div className="metric-sub">Licensed approved</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{totalProfiles}</div>
          <div className="metric-label">Total Profiles</div>
          <div className="metric-sub">In system</div>
        </div>
      </div>

      <div className="section-label">Self-Exclusion Metrics</div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{activeExclusions}</div>
          <div className="metric-label">Active Exclusions</div>
          <div className="metric-sub">Currently enforced</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{totalExclusions}</div>
          <div className="metric-label">Total Exclusions</div>
          <div className="metric-sub">In system</div>
        </div>
      </div>

      <div className="section-label">Exportable Reports</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <label className="field-label" style={{ margin: 0 }}>From</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="field-input" style={{ width: 160 }} />
        <label className="field-label" style={{ margin: 0 }}>To</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="field-input" style={{ width: 160 }} />
        {(dateFrom || dateTo) && (
          <button className="btn btn-small" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Clear range
          </button>
        )}
      </div>
      {(Object.keys(REPORTS) as ReportKey[]).map((key) => {
        const report = REPORTS[key];
        const allowed = report.role === role;
        return (
          <div className="report-row" key={key}>
            <span>{report.label}</span>
            <button
              className="btn btn-small"
              disabled={!allowed || pending}
              title={allowed ? undefined : `${report.role === "COMPLIANCE" ? "Compliance" : "Licensing"} role only`}
              onClick={() => doExport(key)}
            >
              {pending && pendingReport === key ? "Exporting…" : allowed ? "Export" : "Restricted"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
