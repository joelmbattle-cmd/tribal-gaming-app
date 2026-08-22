"use client";

import { useToast } from "@/components/toast";

export function MetricsView({
  avgVerifyDays,
  openExceptions,
  licensingBacklogCount,
  avgBacklogDays,
  auditReadiness,
}: {
  avgVerifyDays: number;
  openExceptions: number;
  licensingBacklogCount: number;
  avgBacklogDays: number;
  auditReadiness: number;
}) {
  const showToast = useToast();
  return (
    <div>
      <div className="view-title">Metrics &amp; Reporting</div>
      <div className="view-sub">Audit-readiness view across Compliance and Licensing activity.</div>

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
          <div className="metric-value">{licensingBacklogCount}</div>
          <div className="metric-label">Licensing Backlog</div>
          <div className="metric-sub">Open applications, avg. {avgBacklogDays} days aged</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{auditReadiness}%</div>
          <div className="metric-label">Audit Readiness</div>
          <div className="metric-sub">Machine records with a complete document trail</div>
        </div>
      </div>

      <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Exportable Reports</div>
      <div className="report-row">
        <span>Machine activity history — full audit trail</span>
        <button className="btn btn-small" onClick={() => showToast("Export prepared (demo)")}>Export</button>
      </div>
      <div className="report-row">
        <span>Licensing cycle time by case</span>
        <button className="btn btn-small" onClick={() => showToast("Export prepared (demo)")}>Export</button>
      </div>
      <div className="report-row">
        <span>Self-exclusion enforcement log</span>
        <button className="btn btn-small" onClick={() => showToast("Export prepared (demo)")}>Export</button>
      </div>
    </div>
  );
}
