"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";
import {
  sendShipmentNotificationsAction,
  createShipmentAction,
  updateShipmentStatusAction,
  addShipmentDocumentAction,
  deleteShipmentDocumentAction,
  linkShipmentMachineAction,
  unlinkShipmentMachineAction,
} from "@/lib/actions/shipments";
import { useShellVariant } from "@/components/shell-variant";
import { useRef } from "react";
import { MachineMultiPicker } from "@/components/machine-multi-picker";
import type { MachineOption } from "@/lib/data/machines";

export type ShipmentMachineItem = {
  id: string;
  serial: string;
  manufacturer: string;
  model: string;
  archived: boolean;
};

export type ShipmentViewItem = {
  id: string;
  type: string;
  vendor: string;
  carrier: string;
  received: string;
  status: string;
  documents: { id: string; name: string; date: string }[];
  extracted: { id: string; key: string; value: string }[];
  notify: { id: string; email: string; sent: boolean }[];
  machines: ShipmentMachineItem[];
};

const STATUS_CHIP: Record<string, string> = { Closed: "chip-cleared", Processing: "chip-investigation", Open: "chip-neutral" };
const TYPE_OPTIONS = ["Inbound", "Outbound"] as const;

export function ShipmentListView({ shipments, machines }: { shipments: ShipmentViewItem[]; machines: MachineOption[] }) {
  const variant = useShellVariant();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>("Inbound");
  const [vendor, setVendor] = useState("");
  const [carrier, setCarrier] = useState("");
  const [emails, setEmails] = useState("");
  const [machineIds, setMachineIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useToast();

  const shipment = shipments.find((s) => s.id === selected);
  const linkedIds = new Set(shipment?.machines.map((m) => m.id) ?? []);
  const linkableMachines = machines.filter((m) => !linkedIds.has(m.id));

  const send = (id: string) => {
    startTransition(async () => {
      await sendShipmentNotificationsAction(id);
      showToast("Notifications sent");
      router.refresh();
    });
  };

  const resetCreateForm = () => {
    setType("Inbound");
    setVendor("");
    setCarrier("");
    setEmails("");
    setMachineIds([]);
  };

  const create = () => {
    if (!vendor.trim() || !carrier.trim()) {
      showToast("Vendor/Shipper and Carrier are required");
      return;
    }
    const emailList = emails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    startTransition(async () => {
      try {
        await createShipmentAction({ type, vendor: vendor.trim(), carrier: carrier.trim(), notifyEmails: emailList, machineIds });
        resetCreateForm();
        setShowCreateForm(false);
        showToast("Shipment created");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to create shipment");
      }
    });
  };

  const complete = (id: string) => {
    startTransition(async () => {
      await updateShipmentStatusAction(id, "Closed");
      setSelected(null);
      showToast("Shipment marked as closed");
      router.refresh();
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const { storage } = await addShipmentDocumentAction(selected, formData);
        showToast(
          storage === "uploaded"
            ? `Document "${file.name}" attached`
            : storage === "skipped"
              ? `"${file.name}" recorded — file storage is not configured`
              : `Upload failed — "${file.name}" recorded without the file`,
        );
        router.refresh();
      } catch {
        showToast("Failed to attach document");
      }
    });
  };

  const deleteDocument = (documentId: string) => {
    startTransition(async () => {
      await deleteShipmentDocumentAction(documentId);
      showToast("Document removed");
      router.refresh();
    });
  };

  const linkMachine = (machineId: string) => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await linkShipmentMachineAction(selected, machineId);
        router.refresh();
      } catch {
        showToast("Failed to link machine");
      }
    });
  };

  const unlinkMachine = (machineId: string) => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await unlinkShipmentMachineAction(selected, machineId);
        showToast("Machine unlinked from shipment");
        router.refresh();
      } catch {
        showToast("Failed to unlink machine");
      }
    });
  };

  return (
    <div>
      <div className="view-head">
        <div>
          <div className="view-title">Shipment Management</div>
          <div className="view-sub">Each shipment has a dedicated folder. AI document scrubbing extracts key fields on receipt.</div>
        </div>
        {variant === "desktop" && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ New Shipment</button>
        )}
      </div>

      <div className="profiles">
        {shipments.map((s) => (
          <button key={s.id} className="profile-row" onClick={() => setSelected(s.id)}>
            <div className="avatar mono">{s.id.slice(-2)}</div>
            <div><div className="p-name">{s.id}</div><div className="p-id">{s.vendor || "—"} · {s.carrier}</div></div>
            <div className="p-id">
              <span className={`chip ${s.type === "Outbound" ? "chip-investigation" : "chip-neutral"}`} style={{ marginRight: 8 }}>
                {s.type}
              </span>
              Received {s.received}
            </div>
            <div><span className={`chip ${STATUS_CHIP[s.status] ?? "chip-neutral"}`}>{s.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <input ref={fileInput} type="file" style={{ display: "none" }} onChange={handleFileUpload} />

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
              <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Shipment Details</div>
              <div className="field-grid">
                <div><div className="field-label">Type</div><div className="field-value">{shipment.type}</div></div>
                <div><div className="field-label">Vendor / Shipper</div><div className="field-value">{shipment.vendor || "—"}</div></div>
                <div><div className="field-label">Carrier</div><div className="field-value">{shipment.carrier}</div></div>
                <div><div className="field-label">Received</div><div className="field-value">{shipment.received}</div></div>
              </div>

              <div className="section-label">AI-Extracted Fields</div>
              <div className="field-grid">
                {shipment.extracted.map((f) => (
                  <div key={f.id}><div className="field-label">{f.key}</div><div className="field-value">{f.value}</div></div>
                ))}
              </div>

              <div className="section-label">Related Machines ({shipment.machines.length})</div>
              {shipment.machines.map((m) => (
                <div className="doc-row" key={m.id}>
                  <span className="doc-icon">▤</span>
                  <span className="doc-name">{m.serial} — {m.manufacturer} {m.model}{m.archived ? " (Archived)" : ""}</span>
                  <button
                    className="doc-delete-btn"
                    onClick={() => unlinkMachine(m.id)}
                    disabled={pending}
                    title="Unlink machine"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <MachineMultiPicker
                machines={linkableMachines}
                selectedIds={[]}
                onChange={(ids) => {
                  const added = ids[ids.length - 1];
                  if (added) linkMachine(added);
                }}
                disabled={pending}
              />

              <div className="section-label">Shipment Folder ({shipment.documents.length})</div>
              {shipment.documents.map((d) => (
                <div className="doc-row" key={d.id}>
                  <span className="doc-icon">▤</span><span className="doc-name">{d.name}</span><span className="doc-meta">{d.date}</span>
                  <button
                    className="doc-delete-btn"
                    onClick={() => deleteDocument(d.id)}
                    disabled={pending}
                    title="Delete document"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="btn" disabled={pending} onClick={() => fileInput.current?.click()} style={{ marginTop: 12 }}>
                + Attach Document
              </button>
              <div className="section-label">Notification List</div>
              {shipment.notify.map((n) => (
                <div className="notify-row" key={n.id}>
                  <span>{n.email}</span>
                  <span className={`notify-status ${n.sent ? "notify-sent" : "notify-unsent"}`}>{n.sent ? "✓ Sent" : "Not sent"}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
                <button className="btn btn-primary" disabled={pending} onClick={() => send(shipment.id)}>
                  Send Prepared Notifications
                </button>
                {shipment.status !== "Closed" && (
                  <button className="btn" disabled={pending} onClick={() => complete(shipment.id)}>
                    Mark as Closed
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </ResponsiveOverlay>

      <ResponsiveOverlay open={showCreateForm} onClose={() => setShowCreateForm(false)}>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow">New Shipment</div>
            <div className="drawer-title">Create Shipment Record</div>
          </div>
          <button className="drawer-close" onClick={() => setShowCreateForm(false)}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Shipment Details</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as (typeof TYPE_OPTIONS)[number])}
                className="field-input"
                disabled={pending}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Vendor / Shipper</label>
              <input
                type="text"
                placeholder="Required — e.g., IGT Corporation"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Carrier Name</label>
              <input
                type="text"
                placeholder="Required — e.g., FedEx, UPS, DHL"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Notification Emails (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g., user1@example.com, user2@example.com"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>

          <div className="section-label">Related Machines</div>
          <MachineMultiPicker machines={machines} selectedIds={machineIds} onChange={setMachineIds} disabled={pending} />

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
            <button className="btn btn-primary" disabled={pending} onClick={create}>
              Create Shipment
            </button>
            <button className="btn" disabled={pending} onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </ResponsiveOverlay>
    </div>
  );
}
