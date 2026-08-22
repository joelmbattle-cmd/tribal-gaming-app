"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";
import { sendShipmentNotificationsAction } from "@/lib/actions/shipments";

export type ShipmentViewItem = {
  id: string;
  carrier: string;
  received: string;
  status: string;
  documents: { id: string; name: string; date: string }[];
  extracted: { id: string; key: string; value: string }[];
  notify: { id: string; email: string; sent: boolean }[];
};

const STATUS_CHIP: Record<string, string> = { Closed: "chip-cleared", Processing: "chip-investigation", Open: "chip-neutral" };

export function ShipmentListView({ shipments }: { shipments: ShipmentViewItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showToast = useToast();

  const shipment = shipments.find((s) => s.id === selected);

  const send = (id: string) => {
    startTransition(async () => {
      await sendShipmentNotificationsAction(id);
      showToast("Notifications sent");
      router.refresh();
    });
  };

  return (
    <div>
      <div className="view-title">Shipment Management</div>
      <div className="view-sub">Each shipment has a dedicated folder. AI document scrubbing extracts key fields on receipt.</div>

      <div className="profiles">
        {shipments.map((s) => (
          <button key={s.id} className="profile-row" onClick={() => setSelected(s.id)}>
            <div className="avatar mono">{s.id.slice(-2)}</div>
            <div><div className="p-name">{s.id}</div><div className="p-id">{s.carrier}</div></div>
            <div className="p-id">Received {s.received}</div>
            <div><span className={`chip ${STATUS_CHIP[s.status] ?? "chip-neutral"}`}>{s.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={() => setSelected(null)}>
        {shipment && (
          <>
            <div className="drawer-head">
              <div>
                <div className="drawer-eyebrow">Shipment Record</div>
                <div className="drawer-title">{shipment.id}</div>
                <div className="p-id" style={{ marginTop: 4 }}>{shipment.carrier} · Received {shipment.received}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>AI-Extracted Fields</div>
              <div className="field-grid">
                {shipment.extracted.map((f) => (
                  <div key={f.id}><div className="field-label">{f.key}</div><div className="field-value">{f.value}</div></div>
                ))}
              </div>
              <div className="section-label">Shipment Folder ({shipment.documents.length})</div>
              {shipment.documents.map((d) => (
                <div className="doc-row" key={d.id}>
                  <span className="doc-icon">▤</span><span className="doc-name">{d.name}</span><span className="doc-meta">{d.date}</span>
                </div>
              ))}
              <div className="section-label">Notification List</div>
              {shipment.notify.map((n) => (
                <div className="notify-row" key={n.id}>
                  <span>{n.email}</span>
                  <span className={`notify-status ${n.sent ? "notify-sent" : "notify-unsent"}`}>{n.sent ? "✓ Sent" : "Not sent"}</span>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" disabled={pending} onClick={() => send(shipment.id)}>
                  Send Prepared Notifications
                </button>
              </div>
            </div>
          </>
        )}
      </ResponsiveOverlay>
    </div>
  );
}
