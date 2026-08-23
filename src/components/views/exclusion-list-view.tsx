"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";
import { useShellVariant } from "@/components/shell-variant";
import { createExclusionAction, uploadExclusionPhotoAction, addExclusionDocumentAction, deleteExclusionDocumentAction, archiveExclusionAction } from "@/lib/actions/exclusions";

export type ExclusionViewItem = {
  id: string;
  status: string;
  enrolled: string;
  term: string;
  photoUrl?: string | null;
  documents: { id: string; name: string; date: string }[];
  notes: { id: string; date: string; event: string }[];
};

export function ExclusionListView({ exclusions }: { exclusions: ExclusionViewItem[] }) {
  const variant = useShellVariant();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Holds the id being confirmed. Cleared whenever the drawer opens or closes
  // so a record can never appear pre-armed when it is reopened.
  const [confirmingArchive, setConfirmingArchive] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("Active");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useToast();
  const exclusion = exclusions.find((c) => c.id === selected);

  const create = () => {
    if (!term.trim()) {
      showToast("Term is required");
      return;
    }
    startTransition(async () => {
      try {
        await createExclusionAction(term, status);
        setTerm("");
        setStatus("Active");
        setShowCreateForm(false);
        showToast("Exclusion created");
        router.refresh();
      } catch {
        showToast("Failed to create exclusion");
      }
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const { storage } = await uploadExclusionPhotoAction(selected, formData);
        showToast(
          storage === "uploaded"
            ? "Photo updated"
            : storage === "skipped"
              ? "Photo not stored — file storage is not configured"
              : "Photo upload failed — the existing photo was kept",
        );
        router.refresh();
      } catch {
        showToast("Failed to upload photo");
      }
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
        const { storage } = await addExclusionDocumentAction(selected, formData);
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
      await deleteExclusionDocumentAction(documentId);
      showToast("Document removed");
      router.refresh();
    });
  };

  const openRecord = (id: string) => {
    setConfirmingArchive(null);
    setSelected(id);
  };

  const closeRecord = () => {
    setConfirmingArchive(null);
    setSelected(null);
  };

  const archive = () => {
    startTransition(async () => {
      try {
        await archiveExclusionAction(selected!);
        setConfirmingArchive(null);
        setSelected(null);
        showToast("Exclusion archived");
        router.refresh();
      } catch {
        showToast("Failed to archive exclusion");
      }
    });
  };

  return (
    <div>
      <input ref={fileInput} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
      <input ref={photoInput} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />

      <div className="view-head">
        <div>
          <div className="view-title">Self-Exclusion Cases</div>
          <div className="view-sub">Controlled files. Access and photo evidence are restricted to authorized Compliance staff.</div>
        </div>
        {variant === "desktop" && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ New Exclusion</button>
        )}
      </div>

      <div className="profiles">
        {exclusions.map((c) => (
          <button key={c.id} className="profile-row" onClick={() => openRecord(c.id)}>
            <div className="avatar-locked">🔒</div>
            <div><div className="p-name">{c.id}</div><div className="p-id">{c.term}</div></div>
            <div className="p-id">Enrolled {c.enrolled}</div>
            <div><span className={`chip ${c.status === "Active" ? "chip-flagged" : "chip-neutral"}`}>{c.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={closeRecord}>
        {exclusion && (
          <>
            <div className="drawer-head">
              <div>
                <div className="drawer-eyebrow">Self-Exclusion Case — Controlled File</div>
                <div className="drawer-title">{exclusion.id}</div>
                <div className="p-id" style={{ marginTop: 4 }}>{exclusion.term} · Enrolled {exclusion.enrolled}</div>
              </div>
              <button className="drawer-close" onClick={closeRecord}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="redacted-box">
                {exclusion.photoUrl ? (
                  <>🔒 Photo on file — restricted access</>
                ) : (
                  <>🔒 No photo on file</>
                )}
              </div>
              <button
                className="btn"
                disabled={pending}
                onClick={() => photoInput.current?.click()}
                style={{ marginTop: 12 }}
              >
                {exclusion.photoUrl ? "Update Photo" : "+ Add Photo"}
              </button>
              <div className="field-grid" style={{ marginTop: 16 }}>
                <div><div className="field-label">Status</div><div className="field-value">{exclusion.status}</div></div>
                <div><div className="field-label">Term</div><div className="field-value">{exclusion.term}</div></div>
              </div>
              <div className="section-label">Documents ({exclusion.documents.length})</div>
              {exclusion.documents.map((d) => (
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
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
                {confirmingArchive === selected ? (
                  <>
                    <div className="field-label">
                      Archiving removes this case from the active list. This cannot be undone from the app.
                    </div>
                    <button className="btn btn-danger" disabled={pending} onClick={archive}>
                      Confirm Archive
                    </button>
                    <button className="btn" disabled={pending} onClick={() => setConfirmingArchive(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn" disabled={pending} onClick={() => setConfirmingArchive(selected)}>
                    Archive Exclusion
                  </button>
                )}
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
            </div>
          </>
        )}
      </ResponsiveOverlay>

      <ResponsiveOverlay open={showCreateForm} onClose={() => setShowCreateForm(false)}>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow">New Exclusion</div>
            <div className="drawer-title">Create Exclusion Record</div>
          </div>
          <button className="drawer-close" onClick={() => setShowCreateForm(false)}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Exclusion Details</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Term</label>
              <input
                type="text"
                placeholder="e.g., 5 years, Lifetime"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
            <button className="btn btn-primary" disabled={pending} onClick={create}>
              Create Exclusion
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
