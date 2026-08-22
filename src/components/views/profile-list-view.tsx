"use client";

import { useState } from "react";
import { ResponsiveOverlay } from "@/components/overlay";

export type ProfileViewItem = {
  id: string;
  name: string;
  role: string;
  status: string;
  documents: { id: string; name: string; date: string | null }[];
  history: { id: string; date: string; event: string }[];
};

const STATUS_CHIP: Record<string, string> = { cleared: "chip-cleared", flagged: "chip-flagged", investigation: "chip-investigation" };
const STATUS_LABEL: Record<string, string> = { cleared: "Cleared", flagged: "Flagged", investigation: "Under Investigation" };
const STAMP_CLASS: Record<string, string> = { cleared: "stamp-verified", flagged: "stamp-flagged", investigation: "stamp-pending" };
const STAMP_TEXT: Record<string, string> = { cleared: "License Issued", flagged: "Review Required", investigation: "In Progress" };

export function ProfileListView({ people }: { people: ProfileViewItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const person = people.find((p) => p.id === selected);

  return (
    <div>
      <div className="view-title">Person Profiles</div>
      <div className="view-sub">Click a profile to review documents and background investigation status.</div>

      <div className="profiles">
        {people.map((p) => (
          <button key={p.id} className="profile-row" onClick={() => setSelected(p.id)}>
            <div className="avatar">{p.name.split(" ").map((w) => w[0]).join("")}</div>
            <div><div className="p-name">{p.name}</div><div className="p-id">{p.id}</div></div>
            <div className="p-id">{p.role}</div>
            <div><span className={`chip ${STATUS_CHIP[p.status] ?? "chip-neutral"}`}>{STATUS_LABEL[p.status] ?? p.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={() => setSelected(null)}>
        {person && (
          <>
            <div className="drawer-head">
              <div>
                <div className="drawer-eyebrow">Licensing Profile</div>
                <div className="drawer-title">{person.name}</div>
                <div className="p-id" style={{ marginTop: 4 }}>{person.id} · {person.role}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="stamp-wrap">
                <div className={`stamp ${STAMP_CLASS[person.status]}`}>{STAMP_TEXT[person.status]}</div>
              </div>
              <div className="field-grid">
                <div><div className="field-label">Profile ID</div><div className="field-value">{person.id}</div></div>
                <div><div className="field-label">Category</div><div className="field-value" style={{ fontFamily: "var(--font-plex-sans)", fontSize: 12.5 }}>{person.role}</div></div>
              </div>
              <div className="section-label">Attached Documents ({person.documents.length})</div>
              {person.documents.map((d) => (
                <div className="doc-row" key={d.id}>
                  <span className="doc-icon">▤</span><span className="doc-name">{d.name}</span><span className="doc-meta">{d.date ?? "pending"}</span>
                </div>
              ))}
              <div className="section-label">Investigation History</div>
              <div className="ledger">
                {person.history.map((h) => (
                  <div className="ledger-item" key={h.id}>
                    <div className="ledger-date">{h.date}</div>
                    <div className="ledger-event">{h.event}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </ResponsiveOverlay>
    </div>
  );
}
