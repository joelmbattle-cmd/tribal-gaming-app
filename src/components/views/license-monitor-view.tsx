"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import {
  MONITOR_BUCKETS,
  MONITOR_BUCKET_LABEL,
  MONITOR_WINDOW_DAYS,
  daysUntilExpiry,
  monitorBucket,
  type MonitorBucket,
} from "@/lib/license-expiry";
import { sendPersonRenewalReminderAction } from "@/lib/actions/people";
import { flagVendorCompanyAction, sendCompanyRenewalReminderAction } from "@/lib/actions/vendor-companies";

export type MonitorPersonItem = {
  id: string;
  name: string;
  role: string;
  licenseExpirationDate: string;
  vendorCompanyId: string | null;
  vendorCompanyName: string | null;
};

export type MonitorCompanyItem = {
  id: string;
  name: string;
  status: string;
  licenseExpirationDate: string;
};

type RowType = "Employee" | "Vendor principal" | "Company";

type Row = {
  key: string;
  kind: "person" | "company";
  id: string;
  name: string;
  detail: string;
  type: RowType;
  expires: string;
  days: number;
  bucket: MonitorBucket;
  href: string;
  /** Company to flag: the company itself, or a vendor principal's parent. */
  flagCompanyId: string | null;
  flagCompanyName: string | null;
  alreadyFlagged: boolean;
};

type Filter = "all" | MonitorBucket;

const BUCKET_CHIP: Record<MonitorBucket, string> = {
  expired: "chip-flagged",
  d0_30: "chip-investigation",
  d31_60: "chip-investigation",
  d61_90: "chip-neutral",
};

function daysLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  return `${days}d`;
}

function buildRows(people: MonitorPersonItem[], companies: MonitorCompanyItem[]): Row[] {
  const statusById = new Map(companies.map((c) => [c.id, c.status]));
  const rows: Row[] = [];
  for (const p of people) {
    const days = daysUntilExpiry(new Date(p.licenseExpirationDate));
    const bucket = monitorBucket(days);
    if (!bucket || days === null) continue;
    const principal = !!p.vendorCompanyId;
    rows.push({
      key: `p-${p.id}`,
      kind: "person",
      id: p.id,
      name: p.name,
      detail: principal ? `${p.vendorCompanyName} principal` : p.role,
      type: principal ? "Vendor principal" : "Employee",
      expires: p.licenseExpirationDate,
      days,
      bucket,
      // Principals open on their company's detail page (which lists principals);
      // employees deep-link into the profiles drawer.
      href: principal ? `/licensing/vendors/${p.vendorCompanyId}` : `/licensing/profiles?person=${encodeURIComponent(p.id)}`,
      flagCompanyId: principal && bucket === "expired" ? p.vendorCompanyId : null,
      flagCompanyName: p.vendorCompanyName,
      alreadyFlagged: p.vendorCompanyId ? statusById.get(p.vendorCompanyId) === "flagged" : false,
    });
  }
  for (const c of companies) {
    const days = daysUntilExpiry(new Date(c.licenseExpirationDate));
    const bucket = monitorBucket(days);
    if (!bucket || days === null) continue;
    rows.push({
      key: `c-${c.id}`,
      kind: "company",
      id: c.id,
      name: c.name,
      detail: c.id,
      type: "Company",
      expires: c.licenseExpirationDate,
      days,
      bucket,
      href: `/licensing/vendors/${c.id}`,
      flagCompanyId: c.id,
      flagCompanyName: c.name,
      alreadyFlagged: c.status === "flagged",
    });
  }
  return rows.sort((a, b) => a.expires.localeCompare(b.expires) || a.name.localeCompare(b.name));
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function exportCsv(rows: Row[], filter: Filter) {
  const header = ["Name", "Type", "Detail", "Band", "Expires", "Days"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.name, r.type, r.detail, MONITOR_BUCKET_LABEL[r.bucket], r.expires, r.days < 0 ? `Expired (${r.days})` : String(r.days)]
        .map(csvCell)
        .join(","),
    ),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `license-monitor-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LicenseMonitorView({ people, companies }: { people: MonitorPersonItem[]; companies: MonitorCompanyItem[] }) {
  const router = useRouter();
  const showToast = useToast();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm(pending);
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => buildRows(people, companies), [people, companies]);
  const counts = useMemo(() => {
    const c: Record<MonitorBucket, number> = { expired: 0, d0_30: 0, d31_60: 0, d61_90: 0 };
    for (const r of rows) c[r.bucket]++;
    return c;
  }, [rows]);
  const visibleBuckets = filter === "all" ? MONITOR_BUCKETS : [filter];
  const filteredRows = rows.filter((r) => visibleBuckets.includes(r.bucket));

  function sendReminder(r: Row) {
    startTransition(async () => {
      try {
        if (r.kind === "person") await sendPersonRenewalReminderAction(r.id);
        else await sendCompanyRenewalReminderAction(r.id);
        showToast(`Renewal reminder recorded for ${r.name}`);
        router.refresh();
      } catch {
        showToast("Couldn't record the reminder — try again");
      }
    });
  }

  function flag(companyId: string, companyName: string) {
    startTransition(async () => {
      try {
        await flagVendorCompanyAction(companyId);
        showToast(`${companyName} flagged`);
        router.refresh();
      } catch {
        showToast("Couldn't flag the company — try again");
      }
    });
  }

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    ...MONITOR_BUCKETS.map((b) => ({ key: b as Filter, label: MONITOR_BUCKET_LABEL[b], count: counts[b] })),
  ];

  return (
    <div>
      <div className="view-head">
        <div>
          <div className="view-title">License Monitor</div>
          <div className="view-sub">Licensees, vendor principals and vendor companies with a license expired or due within {MONITOR_WINDOW_DAYS} days.</div>
        </div>
        <button className="btn btn-small" disabled={filteredRows.length === 0} onClick={() => exportCsv(filteredRows, filter)}>
          Export CSV
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} role="tablist" aria-label="Filter by expiry band">
        {chips.map((c) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={filter === c.key}
            className={`btn btn-small${filter === c.key ? " btn-primary" : ""}`}
            onClick={() => setFilter(c.key)}
          >
            {c.label} <span style={{ opacity: 0.75, marginLeft: 4 }}>{c.count}</span>
          </button>
        ))}
      </div>

      {visibleBuckets.map((b, i) => {
        const bandRows = rows.filter((r) => r.bucket === b);
        return (
          <div key={b}>
            <div className="section-label" style={i === 0 ? { borderTop: "none", marginTop: 0 } : undefined}>
              {MONITOR_BUCKET_LABEL[b]} ({bandRows.length})
            </div>
            {bandRows.length === 0 ? (
              <div className="field-label" style={{ padding: "8px 0 16px" }}>
                None in this band.{filter !== "all" && " Try “All” to see every band."}
              </div>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table className="setup-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Licensee / Company</th>
                      <th style={{ textAlign: "left" }}>Type</th>
                      <th style={{ textAlign: "left" }}>Expires</th>
                      <th style={{ textAlign: "left" }}>Days</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandRows.map((r) => (
                      <tr key={r.key}>
                        <td>
                          <div className="p-name">{r.name}</div>
                          <div className="p-id">{r.detail}</div>
                        </td>
                        <td>{r.type}</td>
                        <td>{r.expires}</td>
                        <td><span className={`chip ${BUCKET_CHIP[r.bucket]}`}>{daysLabel(r.days)}</span></td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <Link className="btn btn-small" href={r.href}>Open profile</Link>{" "}
                          <button
                            className="btn btn-small"
                            disabled={pending}
                            onClick={() =>
                              confirm(
                                {
                                  title: "Send renewal reminder?",
                                  description: r.kind === "person"
                                    ? `Records “Renewal reminder sent” in ${r.name}'s profile history.`
                                    : `Records a renewal reminder for ${r.name}.`,
                                  confirmLabel: "Send Reminder",
                                },
                                () => sendReminder(r),
                              )
                            }
                          >
                            Send reminder
                          </button>
                          {r.flagCompanyId && !r.alreadyFlagged && (
                            <>
                              {" "}
                              <button
                                className="btn btn-small btn-danger"
                                disabled={pending}
                                onClick={() =>
                                  confirm(
                                    {
                                      title: "Flag this company?",
                                      description: `Set ${r.flagCompanyName}'s status to Flagged.`,
                                      confirmLabel: "Flag Company",
                                      danger: true,
                                    },
                                    () => flag(r.flagCompanyId!, r.flagCompanyName ?? "Company"),
                                  )
                                }
                              >
                                Flag company
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {dialog}
    </div>
  );
}
