"use client";

import { useToast } from "@/components/toast";

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
}) {
  const showToast = useToast();
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
