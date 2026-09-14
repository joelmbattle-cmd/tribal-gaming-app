"use client";

import { useMemo, useState } from "react";
import { computeLicensingMetrics, monthPeriod, rangePeriod, type LicensingMetricsPerson } from "@/lib/licensing-metrics";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function shiftMonth(value: string, delta: number): string {
  const [y, m] = value.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function formatMonthLabel(value: string): string {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtDays(avgDays: number | null): string {
  return avgDays === null ? "—" : `${avgDays}d`;
}

export function LicensingMetricsView({ people }: { people: LicensingMetricsPerson[] }) {
  const [mode, setMode] = useState<"month" | "range">("month");
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date();
    return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [rangeTo, setRangeTo] = useState(() => toISODate(new Date()));

  const period = useMemo(() => {
    if (mode === "range" && rangeFrom && rangeTo) return rangePeriod(rangeFrom, rangeTo);
    const [y, m] = monthValue.split("-").map(Number);
    return monthPeriod(y, m - 1);
  }, [mode, monthValue, rangeFrom, rangeTo]);

  const periodLabel = mode === "month" ? formatMonthLabel(monthValue) : `${rangeFrom || "…"} – ${rangeTo || "…"}`;

  const metrics = useMemo(() => computeLicensingMetrics(people, period), [people, period]);

  return (
    <div>
      <div className="view-title">Licensing Metrics &amp; Reporting</div>
      <div className="view-sub">Licensing-only metrics for the selected period. No Compliance data is shown on this page.</div>

      <div className="folder-tabs" style={{ marginTop: 18 }}>
        <button className={`folder-tab${mode === "month" ? " folder-tab-active" : ""}`} onClick={() => setMode("month")}>
          Monthly
        </button>
        <button className={`folder-tab${mode === "range" ? " folder-tab-active" : ""}`} onClick={() => setMode("range")}>
          Custom Range
        </button>
      </div>

      {mode === "month" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <button className="btn btn-small" onClick={() => setMonthValue((v) => shiftMonth(v, -1))} aria-label="Previous month">
            ◀
          </button>
          <div style={{ minWidth: 160, textAlign: "center", fontWeight: 600 }}>{formatMonthLabel(monthValue)}</div>
          <button className="btn btn-small" onClick={() => setMonthValue((v) => shiftMonth(v, 1))} aria-label="Next month">
            ▶
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
          <label className="field-label" style={{ margin: 0 }}>
            From
          </label>
          <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="field-input" style={{ width: 160 }} />
          <label className="field-label" style={{ margin: 0 }}>
            To
          </label>
          <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="field-input" style={{ width: 160 }} />
        </div>
      )}

      <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>
        Investigations Completed — {periodLabel}
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{metrics.investigationsCompleted}</div>
          <div className="metric-label">Investigations Completed</div>
          <div className="metric-sub">Background investigations closed in this period</div>
        </div>
      </div>

      <div className="section-label">Background Process Duration by Type</div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{fmtDays(metrics.duration.vendor.avgDays)}</div>
          <div className="metric-label">Avg. Duration — Vendor Principals</div>
          <div className="metric-sub">
            {metrics.duration.vendor.count === 0
              ? "No vendor investigations completed in this period"
              : `Investigation open to close, ${metrics.duration.vendor.count} completed`}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{fmtDays(metrics.duration.regular.avgDays)}</div>
          <div className="metric-label">Avg. Duration — Regular Licensees</div>
          <div className="metric-sub">
            {metrics.duration.regular.count === 0
              ? "No regular-licensee investigations completed in this period"
              : `Investigation open to close, ${metrics.duration.regular.count} completed`}
          </div>
        </div>
      </div>

      <div className="section-label">Status Outcomes — {periodLabel}</div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{metrics.statusCounts.licensed}</div>
          <div className="metric-label">Licensed</div>
          <div className="metric-sub">Approved, Temporary license, or Licensed with conditions</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.statusCounts.denied}</div>
          <div className="metric-label">Denied</div>
          <div className="metric-sub">Application denied</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.statusCounts.withdrawn}</div>
          <div className="metric-label">Withdrew</div>
          <div className="metric-sub">Application withdrawn</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.statusCounts.separated}</div>
          <div className="metric-label">Separated</div>
          <div className="metric-sub">Licensee separated</div>
        </div>
      </div>
    </div>
  );
}
