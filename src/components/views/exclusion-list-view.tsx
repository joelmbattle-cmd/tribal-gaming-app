"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";

export type ExclusionViewItem = {
  id: string;
  status: string;
  enrolled: string;
  term: string;
  notes: { id: string; date: string; event: string }[];
};

export function ExclusionListView({ exclusions }: { exclusions: ExclusionViewItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const showToast = useToast();
  const exclusion = exclusions.find((c) => c.id === selected);

  return (
    <div>
      <div className="view-title">Self-Exclusion Cases</div>
      <div className="view-sub">Controlled files. Access and photo evidence are restricted to authorized Compliance staff.</div>

      <div className="profiles">
        {exclusions.map((c) => (
          <button key={c.id} className="profile-row" onClick={() => setSelected(c.id)}>
            <div className="avatar-locked">🔒</div>
            <div><div className="p-name">{c.id}</div><div className="p-id">{c.term}</div></div>
            <div className="p-id">Enrolled {c.enrolled}</div>
            <div><span className={`chip ${c.status === "Active" ? "chip-flagged" : "chip-neutral"}`}>{c.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={() => setSelected(null)}>
        {exclusion && (
          <>
            <div className="drawer-head">
              <div>
                <div className="drawer-eyebrow">Self-Exclusion Case — Controlled File</div>
                <div className="drawer-title">{exclusion.id}</div>
                <div className="p-id" style={{ marginTop: 4 }}>{exclusion.term} · Enrolled {exclusion.enrolled}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="redacted-box">🔒 Photo on file — restricted access</div>
              <div className="field-grid">
                <div><div className="field-label">Status</div><div className="field-value">{exclusion.status}</div></div>
                <div><div className="field-label">Term</div><div className="field-value">{exclusion.term}</div></div>
              </div>
              <div className="section-label">Case Notes &amp; History</div>
              <div className="ledger">
                {exclusion.notes.map((h) => (
                  <div className="ledger-item" key={h.id}>
                    <div className="ledger-date">{h.date}</div>
                    <div className="ledger-event">{h.event}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn" onClick={() => showToast("Report view opened (demo)")}>Open Report View</button>
              </div>
            </div>
          </>
        )}
      </ResponsiveOverlay>
    </div>
  );
}
