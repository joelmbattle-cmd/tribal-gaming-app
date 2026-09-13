"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";
import { useShellVariant } from "@/components/shell-variant";
import { preparePhoto } from "@/lib/image-client";
import { createExclusionAction, uploadExclusionPhotoAction, addExclusionDocumentAction, deleteExclusionDocumentAction, archiveExclusionAction, unarchiveExclusionAction } from "@/lib/actions/exclusions";

export type ExclusionViewItem = {
  id: string;
  status: string;
  enrolled: string;
  term: string;
  photoUrl?: string | null;
  personName?: string | null;
  aliases?: string | null;
  dateOfBirth?: string | null;
  governmentId?: string | null;
  exclusionType?: string | null;
  expirationDate?: string | null;
  restrictions?: string | null;
  sourceInitiated?: string | null;
  createdBy?: string | null;
  lastModifiedBy?: string | null;
  archived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  documents: { id: string; name: string; date: string }[];
  notes: { id: string; date: string; event: string }[];
};

const STATUS_OPTIONS = ["Active", "Expired", "Removed", "Under Review"];
const EXCLUSION_TYPE_OPTIONS = ["Self-Exclusion", "Involuntary Exclusion", "Other"];

export function ExclusionListView({ exclusions, showArchived }: { exclusions: ExclusionViewItem[]; showArchived: boolean }) {
  const variant = useShellVariant();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Holds the id being confirmed. Cleared whenever the drawer opens or closes
  // so a record can never appear pre-armed when it is reopened.
  const [confirmingArchive, setConfirmingArchive] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [aliases, setAliases] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [governmentId, setGovernmentId] = useState("");
  const [exclusionType, setExclusionType] = useState(EXCLUSION_TYPE_OPTIONS[0]);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);
  const [expirationDate, setExpirationDate] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [sourceInitiated, setSourceInitiated] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useToast();
  const exclusion = exclusions.find((c) => c.id === selected);

  const resetForm = () => {
    setPersonName("");
    setAliases("");
    setDateOfBirth("");
    setGovernmentId("");
    setExclusionType(EXCLUSION_TYPE_OPTIONS[0]);
    setTerm("");
    setStatus(STATUS_OPTIONS[0]);
    setExpirationDate("");
    setRestrictions("");
    setSourceInitiated("");
  };

  const create = () => {
    if (!personName.trim() || !term.trim()) {
      showToast("Person name and term are required");
      return;
    }
    startTransition(async () => {
      try {
        await createExclusionAction({
          personName: personName.trim(),
          aliases: aliases.trim(),
          dateOfBirth,
          governmentId: governmentId.trim(),
          exclusionType,
          term: term.trim(),
          status,
          expirationDate,
          restrictions: restrictions.trim(),
          sourceInitiated: sourceInitiated.trim(),
        });
        resetForm();
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

    startTransition(async () => {
      try {
        // Downscale before sending: a camera photo exceeds the server action
        // body limit and would be rejected before reaching the upload code.
        const prepared = await preparePhoto(file);
        const formData = new FormData();
        formData.set("file", prepared);

        const { storage } = await uploadExclusionPhotoAction(selected, formData);
        showToast(
          storage === "stored"
            ? "Photo updated"
            : storage === "too-large"
              ? "Photo is too large to store — try a smaller image"
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

  const unarchive = () => {
    startTransition(async () => {
      try {
        await unarchiveExclusionAction(selected!);
        setSelected(null);
        showToast("Exclusion restored");
        router.refresh();
      } catch {
        showToast("Failed to restore exclusion");
      }
    });
  };

  const toggleShowArchived = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (showArchived) params.delete("archived");
    else params.set("archived", "1");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div>
      <input ref={fileInput} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
      <input ref={photoInput} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />

      <div className="view-head">
        <div>
          <div className="view-title">{showArchived ? "Archived Self-Exclusion Cases" : "Self-Exclusion Cases"}</div>
          <div className="view-sub">Controlled files. Access and photo evidence are restricted to authorized Compliance staff.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={toggleShowArchived}>
            {showArchived ? "Show Active" : "Show Archived"}
          </button>
          {variant === "desktop" && !showArchived && (
            <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ New Exclusion</button>
          )}
        </div>
      </div>

      <div className="profiles">
        {exclusions.length === 0 && (
          <div className="field-label" style={{ padding: 16 }}>
            {showArchived ? "No archived exclusions." : "No active exclusions."}
          </div>
        )}
        {exclusions.map((c) => (
          <button key={c.id} className="profile-row" onClick={() => openRecord(c.id)}>
            <div className="avatar-locked">🔒</div>
            <div><div className="p-name">{c.personName || c.id}</div><div className="p-id">{c.id} · {c.term}</div></div>
            <div className="p-id">
              {showArchived ? `Archived ${c.archivedAt ?? ""} by ${c.archivedBy || "—"}` : `Enrolled ${c.enrolled}`}
            </div>
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
                <div className="drawer-title">{exclusion.personName || exclusion.id}</div>
                <div className="p-id" style={{ marginTop: 4 }}>{exclusion.id} · {exclusion.term} · Enrolled {exclusion.enrolled}</div>
              </div>
              <button className="drawer-close" onClick={closeRecord}>✕</button>
            </div>
            <div className="drawer-body">
              {exclusion.photoUrl ? (
                <>
                  <div className="photo-frame">
                    {/* Plain <img>: the source is either a blob URL or an inline
                        data URL, and next/image handles neither without extra
                        remote-pattern configuration. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="photo-img"
                      src={exclusion.photoUrl}
                      alt={`Photo on file for exclusion case ${exclusion.id}`}
                    />
                  </div>
                  <div className="photo-caption">🔒 Photo on file — restricted access</div>
                </>
              ) : (
                <div className="redacted-box">🔒 No photo on file</div>
              )}
              <button
                className="btn"
                disabled={pending}
                onClick={() => photoInput.current?.click()}
                style={{ marginTop: 12 }}
              >
                {exclusion.photoUrl ? "Update Photo" : "+ Add Photo"}
              </button>

              <div className="section-label" style={{ marginTop: 16 }}>Person Identification</div>
              <div className="field-grid">
                <div><div className="field-label">Full Legal Name</div><div className="field-value">{exclusion.personName || "—"}</div></div>
                <div><div className="field-label">Known Aliases</div><div className="field-value">{exclusion.aliases || "—"}</div></div>
                <div><div className="field-label">Date of Birth</div><div className="field-value">{exclusion.dateOfBirth || "—"}</div></div>
                <div><div className="field-label">Government / Tribal ID</div><div className="field-value">{exclusion.governmentId || "—"}</div></div>
              </div>

              <div className="section-label">Exclusion Details</div>
              <div className="field-grid">
                <div><div className="field-label">Type</div><div className="field-value">{exclusion.exclusionType || "—"}</div></div>
                <div><div className="field-label">Status</div><div className="field-value">{exclusion.status}</div></div>
                <div><div className="field-label">Term</div><div className="field-value">{exclusion.term}</div></div>
                <div><div className="field-label">Expiration Date</div><div className="field-value">{exclusion.expirationDate || "—"}</div></div>
                <div><div className="field-label">Source / How Initiated</div><div className="field-value">{exclusion.sourceInitiated || "—"}</div></div>
              </div>
              <div className="field-label" style={{ marginTop: 12 }}>Restrictions / Terms</div>
              <div className="field-value">{exclusion.restrictions || "—"}</div>

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
                {exclusion.archived ? (
                  <button className="btn btn-primary" disabled={pending} onClick={unarchive}>
                    Restore Exclusion
                  </button>
                ) : confirmingArchive === selected ? (
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
              <div className="section-label">System &amp; Audit</div>
              <div className="field-grid">
                <div><div className="field-label">Created By</div><div className="field-value">{exclusion.createdBy || "—"}</div></div>
                <div><div className="field-label">Last Modified By</div><div className="field-value">{exclusion.lastModifiedBy || "—"}</div></div>
                <div><div className="field-label">Archived By</div><div className="field-value">{exclusion.archivedBy ? `${exclusion.archivedBy} on ${exclusion.archivedAt}` : "—"}</div></div>
                <div><div className="field-label">Restored By</div><div className="field-value">{exclusion.restoredBy ? `${exclusion.restoredBy} on ${exclusion.restoredAt}` : "—"}</div></div>
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
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Person Identification</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Full Legal Name</label>
              <input
                type="text"
                placeholder="Required"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Known Aliases</label>
              <input
                type="text"
                placeholder="Optional"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Government / Tribal ID</label>
              <input
                type="text"
                placeholder="Optional"
                value={governmentId}
                onChange={(e) => setGovernmentId(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>

          <div className="section-label">Exclusion Details</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Type</label>
              <select
                value={exclusionType}
                onChange={(e) => setExclusionType(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                {EXCLUSION_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
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
              <label className="field-label">Expiration Date</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Source / How Initiated</label>
              <input
                type="text"
                placeholder="e.g., In-person request, hotline"
                value={sourceInitiated}
                onChange={(e) => setSourceInitiated(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Restrictions / Terms</label>
            <textarea
              placeholder="Optional"
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              className="field-input"
              rows={3}
              disabled={pending}
            />
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
