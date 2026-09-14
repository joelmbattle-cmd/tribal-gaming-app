"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ResponsiveOverlay } from "@/components/overlay";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import { preparePhoto } from "@/lib/image-client";
import { PhotoAdjuster } from "@/components/photo-adjuster";
import { DocumentChecklist, type ChecklistDocument } from "@/components/document-checklist";
import { NoObjectionFanout } from "@/components/no-objection-fanout";
import type { DocumentSlot } from "@/lib/document-slots";
import { createPersonAction, updatePersonAction, uploadPersonPhotoAction, addPersonDocumentAction, replacePersonDocumentAction, deletePersonDocumentAction, archivePersonAction, unarchivePersonAction } from "@/lib/actions/people";

export type ProfileViewItem = {
  id: string;
  name: string;
  role: string;
  status: string;
  photoUrl?: string | null;
  dateOfBirth?: string | null;
  contactInfo?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
  licenseIssueDate?: string | null;
  licenseExpirationDate?: string | null;
  applicationDate?: string | null;
  applicationStatus?: string | null;
  backgroundStatus?: string | null;
  suitabilityDetermination?: string | null;
  assignedInvestigator?: string | null;
  investigationStartDate?: string | null;
  investigationCompletionDate?: string | null;
  keyFindings?: string | null;
  createdBy?: string | null;
  lastModifiedBy?: string | null;
  archived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  restoredAt?: string | null;
  restoredBy?: string | null;
  documents: ChecklistDocument[];
  history: { id: string; date: string; event: string }[];
};

const STATUS_CHIP: Record<string, string> = { cleared: "chip-cleared", flagged: "chip-flagged", investigation: "chip-investigation" };
const STATUS_LABEL: Record<string, string> = { cleared: "Cleared", flagged: "Flagged", investigation: "Under Investigation" };
const STAMP_CLASS: Record<string, string> = { cleared: "stamp-verified", flagged: "stamp-flagged", investigation: "stamp-pending" };
const STAMP_TEXT: Record<string, string> = { cleared: "License Issued", flagged: "Review Required", investigation: "In Progress" };

const LICENSE_TYPE_OPTIONS = ["Employee", "Vendor", "Key", "Other"];
const APPLICATION_STATUS_OPTIONS = ["Received", "Under Review", "Additional Info Needed", "Accepted", "Rejected", "Closed"];
const BACKGROUND_STATUS_OPTIONS = ["Not Started", "In Review", "Approved", "Denied", "Needs Info"];
const SUITABILITY_OPTIONS = ["Pending", "Suitable", "Unsuitable"];

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("");
}

export function ProfileListView({ people, showArchived }: { people: ProfileViewItem[]; showArchived: boolean }) {
  const variant = useShellVariant();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Holds the id being confirmed. Cleared whenever the drawer opens or closes
  // so a record can never appear pre-armed when it is reopened.
  const [confirmingArchive, setConfirmingArchive] = useState<string | null>(null);
  // Holds the id being edited. Cleared whenever the drawer opens or closes,
  // same reasoning as confirmingArchive above.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPersonStatus, setEditPersonStatus] = useState("investigation");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editContactInfo, setEditContactInfo] = useState("");
  const [editLicenseType, setEditLicenseType] = useState(LICENSE_TYPE_OPTIONS[0]);
  const [editLicenseNumber, setEditLicenseNumber] = useState("");
  const [editLicenseIssueDate, setEditLicenseIssueDate] = useState("");
  const [editLicenseExpirationDate, setEditLicenseExpirationDate] = useState("");
  const [editApplicationDate, setEditApplicationDate] = useState("");
  const [editApplicationStatus, setEditApplicationStatus] = useState(APPLICATION_STATUS_OPTIONS[0]);
  const [editBackgroundStatus, setEditBackgroundStatus] = useState(BACKGROUND_STATUS_OPTIONS[0]);
  const [editSuitabilityDetermination, setEditSuitabilityDetermination] = useState(SUITABILITY_OPTIONS[0]);
  const [editAssignedInvestigator, setEditAssignedInvestigator] = useState("");
  const [editInvestigationStartDate, setEditInvestigationStartDate] = useState("");
  const [editInvestigationCompletionDate, setEditInvestigationCompletionDate] = useState("");
  const [editKeyFindings, setEditKeyFindings] = useState("");
  // Holds a freshly-picked photo while the operator centers the face in the
  // adjuster, before it's cropped and handed to the upload action.
  const [adjustingPhoto, setAdjustingPhoto] = useState<File | null>(null);
  const [showFanout, setShowFanout] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personStatus, setPersonStatus] = useState("investigation");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [licenseType, setLicenseType] = useState(LICENSE_TYPE_OPTIONS[0]);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseIssueDate, setLicenseIssueDate] = useState("");
  const [licenseExpirationDate, setLicenseExpirationDate] = useState("");
  const [applicationDate, setApplicationDate] = useState("");
  const [applicationStatus, setApplicationStatus] = useState(APPLICATION_STATUS_OPTIONS[0]);
  const [backgroundStatus, setBackgroundStatus] = useState(BACKGROUND_STATUS_OPTIONS[0]);
  const [suitabilityDetermination, setSuitabilityDetermination] = useState(SUITABILITY_OPTIONS[0]);
  const [assignedInvestigator, setAssignedInvestigator] = useState("");
  const [investigationStartDate, setInvestigationStartDate] = useState("");
  const [investigationCompletionDate, setInvestigationCompletionDate] = useState("");
  const [keyFindings, setKeyFindings] = useState("");
  const [pending, startTransition] = useTransition();
  const photoInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useToast();
  const person = people.find((p) => p.id === selected);

  const resetForm = () => {
    setName("");
    setRole("");
    setPersonStatus("investigation");
    setDateOfBirth("");
    setContactInfo("");
    setLicenseType(LICENSE_TYPE_OPTIONS[0]);
    setLicenseNumber("");
    setLicenseIssueDate("");
    setLicenseExpirationDate("");
    setApplicationDate("");
    setApplicationStatus(APPLICATION_STATUS_OPTIONS[0]);
    setBackgroundStatus(BACKGROUND_STATUS_OPTIONS[0]);
    setSuitabilityDetermination(SUITABILITY_OPTIONS[0]);
    setAssignedInvestigator("");
    setInvestigationStartDate("");
    setInvestigationCompletionDate("");
    setKeyFindings("");
  };

  const create = () => {
    if (!name.trim() || !role.trim()) {
      showToast("Name and role are required");
      return;
    }
    startTransition(async () => {
      try {
        await createPersonAction({
          name: name.trim(),
          role: role.trim(),
          status: personStatus,
          dateOfBirth,
          contactInfo: contactInfo.trim(),
          licenseType,
          licenseNumber: licenseNumber.trim(),
          licenseIssueDate,
          licenseExpirationDate,
          applicationDate,
          applicationStatus,
          backgroundStatus,
          suitabilityDetermination,
          assignedInvestigator: assignedInvestigator.trim(),
          investigationStartDate,
          investigationCompletionDate,
          keyFindings: keyFindings.trim(),
        });
        resetForm();
        setShowCreateForm(false);
        showToast("Profile created");
        router.refresh();
      } catch {
        showToast("Failed to create profile");
      }
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    setAdjustingPhoto(file);
  };

  const cancelPhotoAdjust = () => setAdjustingPhoto(null);

  const confirmPhotoAdjust = (cropped: File) => {
    setAdjustingPhoto(null);
    if (!selected) return;

    startTransition(async () => {
      try {
        // Downscale before sending: a camera photo exceeds the server action
        // body limit and would be rejected before reaching the upload code.
        const prepared = await preparePhoto(cropped);
        const formData = new FormData();
        formData.set("file", prepared);

        const { storage } = await uploadPersonPhotoAction(selected, formData);
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

  const uploadDocumentToSlot = (slot: DocumentSlot, file: File) => {
    if (!selected) return;
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const { storage } = await addPersonDocumentAction(selected, slot, formData);
        showToast(
          storage === "uploaded"
            ? "Document attached"
            : storage === "skipped"
              ? "Document recorded — file storage is not configured"
              : "Upload failed — document recorded without the file",
        );
        router.refresh();
      } catch {
        showToast("Failed to attach document");
      }
    });
  };

  const replaceDocument = (documentId: string, file: File) => {
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const { storage } = await replacePersonDocumentAction(documentId, formData);
        showToast(storage === "uploaded" ? "File replaced" : "File replaced — storage is not configured");
        router.refresh();
      } catch {
        showToast("Failed to replace document");
      }
    });
  };

  const removeDocument = (documentId: string) => {
    startTransition(async () => {
      try {
        await deletePersonDocumentAction(documentId);
        showToast("Document removed");
        router.refresh();
      } catch {
        showToast("Failed to remove document");
      }
    });
  };

  const openRecord = (id: string) => {
    setConfirmingArchive(null);
    setEditingId(null);
    setSelected(id);
  };

  const closeRecord = () => {
    setConfirmingArchive(null);
    setEditingId(null);
    setSelected(null);
  };

  const startEdit = (p: ProfileViewItem) => {
    setEditName(p.name);
    setEditRole(p.role);
    setEditPersonStatus(p.status);
    setEditDateOfBirth(p.dateOfBirth ?? "");
    setEditContactInfo(p.contactInfo ?? "");
    setEditLicenseType(p.licenseType ?? LICENSE_TYPE_OPTIONS[0]);
    setEditLicenseNumber(p.licenseNumber ?? "");
    setEditLicenseIssueDate(p.licenseIssueDate ?? "");
    setEditLicenseExpirationDate(p.licenseExpirationDate ?? "");
    setEditApplicationDate(p.applicationDate ?? "");
    setEditApplicationStatus(p.applicationStatus ?? APPLICATION_STATUS_OPTIONS[0]);
    setEditBackgroundStatus(p.backgroundStatus ?? BACKGROUND_STATUS_OPTIONS[0]);
    setEditSuitabilityDetermination(p.suitabilityDetermination ?? SUITABILITY_OPTIONS[0]);
    setEditAssignedInvestigator(p.assignedInvestigator ?? "");
    setEditInvestigationStartDate(p.investigationStartDate ?? "");
    setEditInvestigationCompletionDate(p.investigationCompletionDate ?? "");
    setEditKeyFindings(p.keyFindings ?? "");
    setEditingId(p.id);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editName.trim() || !editRole.trim()) {
      showToast("Full legal name and role are required");
      return;
    }
    startTransition(async () => {
      try {
        await updatePersonAction(editingId!, {
          name: editName.trim(),
          role: editRole.trim(),
          status: editPersonStatus,
          dateOfBirth: editDateOfBirth,
          contactInfo: editContactInfo.trim(),
          licenseType: editLicenseType,
          licenseNumber: editLicenseNumber.trim(),
          licenseIssueDate: editLicenseIssueDate,
          licenseExpirationDate: editLicenseExpirationDate,
          applicationDate: editApplicationDate,
          applicationStatus: editApplicationStatus,
          backgroundStatus: editBackgroundStatus,
          suitabilityDetermination: editSuitabilityDetermination,
          assignedInvestigator: editAssignedInvestigator.trim(),
          investigationStartDate: editInvestigationStartDate,
          investigationCompletionDate: editInvestigationCompletionDate,
          keyFindings: editKeyFindings.trim(),
        });
        setEditingId(null);
        showToast("Profile updated");
        router.refresh();
      } catch {
        showToast("Failed to update profile");
      }
    });
  };

  const archive = () => {
    startTransition(async () => {
      try {
        await archivePersonAction(selected!);
        setConfirmingArchive(null);
        setSelected(null);
        showToast("Profile archived");
        router.refresh();
      } catch {
        showToast("Failed to archive profile");
      }
    });
  };

  const unarchive = () => {
    startTransition(async () => {
      try {
        await unarchivePersonAction(selected!);
        setSelected(null);
        showToast("Profile restored");
        router.refresh();
      } catch {
        showToast("Failed to restore profile");
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
      <input ref={photoInput} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />

      <div className="view-head">
        <div>
          <div className="view-title">{showArchived ? "Archived Person Profiles" : "Person Profiles"}</div>
          <div className="view-sub">Click a profile to review documents and background investigation status.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={toggleShowArchived}>
            {showArchived ? "Show Active" : "Show Archived"}
          </button>
          {variant === "desktop" && !showArchived && (
            <>
              <button className="btn" onClick={() => setShowFanout(true)}>Send No-Objection Letter</button>
              <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ New Profile</button>
            </>
          )}
        </div>
      </div>

      <div className="profiles">
        {people.length === 0 && (
          <div className="field-label" style={{ padding: 16 }}>
            {showArchived ? "No archived profiles." : "No active profiles."}
          </div>
        )}
        {people.map((p) => (
          <button key={p.id} className="profile-row" onClick={() => openRecord(p.id)}>
            {p.photoUrl ? (
              // Plain <img>: the source is either a blob URL or an inline
              // data URL, and next/image handles neither without extra
              // remote-pattern configuration.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar-photo" src={p.photoUrl} alt="" />
            ) : (
              <div className="avatar">{initials(p.name)}</div>
            )}
            <div><div className="p-name">{p.name}</div><div className="p-id">{p.id}</div></div>
            <div className="p-id">
              {showArchived ? `Archived ${p.archivedAt ?? ""} by ${p.archivedBy || "—"}` : p.role}
            </div>
            <div><span className={`chip ${STATUS_CHIP[p.status] ?? "chip-neutral"}`}>{STATUS_LABEL[p.status] ?? p.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={closeRecord}>
        {person && (() => {
          // Re-derived from the current record (not just editingId) so a
          // profile archived out from under an open edit immediately drops
          // back to view-only instead of leaving stale inputs on screen.
          const isEditing = editingId === person.id && !person.archived;
          return (
          <>
            <div className="drawer-head">
              <div>
                <div className="drawer-eyebrow">Licensing Profile</div>
                <div className="drawer-title">{person.name}</div>
                <div className="p-id" style={{ marginTop: 4 }}>{person.id} · {person.role}</div>
              </div>
              <button className="drawer-close" onClick={closeRecord}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="stamp-wrap">
                <div className={`stamp ${STAMP_CLASS[person.status]}`}>{STAMP_TEXT[person.status]}</div>
              </div>
              {person.photoUrl && (
                <div className="photo-frame">
                  {/* Plain <img>: the source is either a blob URL or an inline
                      data URL, and next/image handles neither without extra
                      remote-pattern configuration. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="photo-img"
                    src={person.photoUrl}
                    alt={`Photo on file for ${person.name}`}
                  />
                </div>
              )}
              <button
                className="btn"
                disabled={pending}
                onClick={() => photoInput.current?.click()}
                style={{ marginTop: 12 }}
              >
                {person.photoUrl ? "Update Photo" : "+ Add Photo"}
              </button>

              {!person.archived && (
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  {isEditing ? (
                    <>
                      <button className="btn btn-primary" disabled={pending} onClick={saveEdit}>
                        Save Changes
                      </button>
                      <button className="btn" disabled={pending} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn" disabled={pending} onClick={() => startEdit(person)}>
                      Edit Details
                    </button>
                  )}
                </div>
              )}

              <div className="section-label" style={{ marginTop: 16 }}>Identification</div>
              {isEditing ? (
                <div className="field-grid">
                  <div>
                    <label className="field-label">Full Legal Name</label>
                    <input type="text" className="field-input" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Category</label>
                    <input type="text" className="field-input" value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Status</label>
                    <select className="field-input" value={editPersonStatus} onChange={(e) => setEditPersonStatus(e.target.value)} disabled={pending}>
                      <option value="cleared">Cleared</option>
                      <option value="flagged">Flagged</option>
                      <option value="investigation">Under Investigation</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Date of Birth</label>
                    <input type="date" className="field-input" value={editDateOfBirth} onChange={(e) => setEditDateOfBirth(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Contact Info</label>
                    <input type="text" className="field-input" value={editContactInfo} onChange={(e) => setEditContactInfo(e.target.value)} disabled={pending} />
                  </div>
                  <div><div className="field-label">Profile ID</div><div className="field-value">{person.id}</div></div>
                </div>
              ) : (
                <div className="field-grid">
                  <div><div className="field-label">Profile ID</div><div className="field-value">{person.id}</div></div>
                  <div><div className="field-label">Category</div><div className="field-value" style={{ fontFamily: "var(--font-plex-sans)", fontSize: 12.5 }}>{person.role}</div></div>
                  <div><div className="field-label">Date of Birth</div><div className="field-value">{person.dateOfBirth || "—"}</div></div>
                  <div><div className="field-label">Contact Info</div><div className="field-value">{person.contactInfo || "—"}</div></div>
                </div>
              )}

              <div className="section-label">License</div>
              {isEditing ? (
                <div className="field-grid">
                  <div>
                    <label className="field-label">License Type</label>
                    <select className="field-input" value={editLicenseType} onChange={(e) => setEditLicenseType(e.target.value)} disabled={pending}>
                      {LICENSE_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">License Number</label>
                    <input type="text" className="field-input" value={editLicenseNumber} onChange={(e) => setEditLicenseNumber(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Issue Date</label>
                    <input type="date" className="field-input" value={editLicenseIssueDate} onChange={(e) => setEditLicenseIssueDate(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Expiration Date</label>
                    <input type="date" className="field-input" value={editLicenseExpirationDate} onChange={(e) => setEditLicenseExpirationDate(e.target.value)} disabled={pending} />
                  </div>
                </div>
              ) : (
                <div className="field-grid">
                  <div><div className="field-label">License Type</div><div className="field-value">{person.licenseType || "—"}</div></div>
                  <div><div className="field-label">License Number</div><div className="field-value">{person.licenseNumber || "—"}</div></div>
                  <div><div className="field-label">Issue Date</div><div className="field-value">{person.licenseIssueDate || "—"}</div></div>
                  <div><div className="field-label">Expiration Date</div><div className="field-value">{person.licenseExpirationDate || "—"}</div></div>
                </div>
              )}

              <div className="section-label">Application &amp; Status</div>
              {isEditing ? (
                <div className="field-grid">
                  <div>
                    <label className="field-label">Application Date</label>
                    <input type="date" className="field-input" value={editApplicationDate} onChange={(e) => setEditApplicationDate(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Application Status</label>
                    <select className="field-input" value={editApplicationStatus} onChange={(e) => setEditApplicationStatus(e.target.value)} disabled={pending}>
                      {APPLICATION_STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Background Status</label>
                    <select className="field-input" value={editBackgroundStatus} onChange={(e) => setEditBackgroundStatus(e.target.value)} disabled={pending}>
                      {BACKGROUND_STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Suitability Determination</label>
                    <select className="field-input" value={editSuitabilityDetermination} onChange={(e) => setEditSuitabilityDetermination(e.target.value)} disabled={pending}>
                      {SUITABILITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="field-grid">
                  <div><div className="field-label">Application Date</div><div className="field-value">{person.applicationDate || "—"}</div></div>
                  <div><div className="field-label">Application Status</div><div className="field-value">{person.applicationStatus || "—"}</div></div>
                  <div><div className="field-label">Background Status</div><div className="field-value">{person.backgroundStatus || "—"}</div></div>
                  <div><div className="field-label">Suitability Determination</div><div className="field-value">{person.suitabilityDetermination || "—"}</div></div>
                </div>
              )}

              <div className="section-label">Investigation Tracking</div>
              {isEditing ? (
                <div className="field-grid">
                  <div>
                    <label className="field-label">Assigned Investigator</label>
                    <input type="text" className="field-input" value={editAssignedInvestigator} onChange={(e) => setEditAssignedInvestigator(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Investigation Start</label>
                    <input type="date" className="field-input" value={editInvestigationStartDate} onChange={(e) => setEditInvestigationStartDate(e.target.value)} disabled={pending} />
                  </div>
                  <div>
                    <label className="field-label">Investigation Completion</label>
                    <input type="date" className="field-input" value={editInvestigationCompletionDate} onChange={(e) => setEditInvestigationCompletionDate(e.target.value)} disabled={pending} />
                  </div>
                </div>
              ) : (
                <div className="field-grid">
                  <div><div className="field-label">Assigned Investigator</div><div className="field-value">{person.assignedInvestigator || "—"}</div></div>
                  <div><div className="field-label">Investigation Start</div><div className="field-value">{person.investigationStartDate || "—"}</div></div>
                  <div><div className="field-label">Investigation Completion</div><div className="field-value">{person.investigationCompletionDate || "—"}</div></div>
                </div>
              )}

              {isEditing ? (
                <div style={{ marginTop: 12 }}>
                  <label className="field-label">Key Findings</label>
                  <textarea className="field-input" rows={3} value={editKeyFindings} onChange={(e) => setEditKeyFindings(e.target.value)} disabled={pending} />
                </div>
              ) : (
                <>
                  <div className="field-label" style={{ marginTop: 12 }}>Key Findings</div>
                  <div className="field-value">{person.keyFindings || "—"}</div>
                </>
              )}

              <div className="section-label">Document Checklist</div>
              <DocumentChecklist
                documents={person.documents}
                archived={person.archived}
                pending={pending}
                onUpload={uploadDocumentToSlot}
                onReplace={replaceDocument}
                onRemove={removeDocument}
              />

              <div className="section-label">Investigation History</div>
              <div className="ledger">
                {person.history.map((h) => (
                  <div className="ledger-item" key={h.id}>
                    <div className="ledger-date">{h.date}</div>
                    <div className="ledger-event">{h.event}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
                {person.archived ? (
                  <button className="btn btn-primary" disabled={pending} onClick={unarchive}>
                    Restore Profile
                  </button>
                ) : confirmingArchive === selected ? (
                  <>
                    <div className="field-label">
                      Archiving removes this profile from the active roster. This cannot be undone from the app.
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
                    Archive Profile
                  </button>
                )}
              </div>
              <div className="section-label">System &amp; Audit</div>
              <div className="field-grid">
                <div><div className="field-label">Created By</div><div className="field-value">{person.createdBy || "—"}</div></div>
                <div><div className="field-label">Last Modified By</div><div className="field-value">{person.lastModifiedBy || "—"}</div></div>
                <div><div className="field-label">Archived By</div><div className="field-value">{person.archivedBy ? `${person.archivedBy} on ${person.archivedAt}` : "—"}</div></div>
                <div><div className="field-label">Restored By</div><div className="field-value">{person.restoredBy ? `${person.restoredBy} on ${person.restoredAt}` : "—"}</div></div>
              </div>
            </div>
          </>
          );
        })()}
      </ResponsiveOverlay>

      <ResponsiveOverlay open={showCreateForm} onClose={() => setShowCreateForm(false)}>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow">New Profile</div>
            <div className="drawer-title">Create Person Profile</div>
          </div>
          <button className="drawer-close" onClick={() => setShowCreateForm(false)}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Identification</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Full Legal Name</label>
              <input
                type="text"
                placeholder="Required"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Role / Category</label>
              <input
                type="text"
                placeholder="e.g., Applicant — Key Employee"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select
                value={personStatus}
                onChange={(e) => setPersonStatus(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                <option value="cleared">Cleared</option>
                <option value="flagged">Flagged</option>
                <option value="investigation">Under Investigation</option>
              </select>
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
              <label className="field-label">Contact Info</label>
              <input
                type="text"
                placeholder="Phone / email / address"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>

          <div className="section-label">License</div>
          <div className="field-grid">
            <div>
              <label className="field-label">License Type</label>
              <select
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                {LICENSE_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">License Number</label>
              <input
                type="text"
                placeholder="Once issued"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Issue Date</label>
              <input
                type="date"
                value={licenseIssueDate}
                onChange={(e) => setLicenseIssueDate(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Expiration Date</label>
              <input
                type="date"
                value={licenseExpirationDate}
                onChange={(e) => setLicenseExpirationDate(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>

          <div className="section-label">Application &amp; Status</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Application Date</label>
              <input
                type="date"
                value={applicationDate}
                onChange={(e) => setApplicationDate(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Application Status</label>
              <select
                value={applicationStatus}
                onChange={(e) => setApplicationStatus(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                {APPLICATION_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Background Status</label>
              <select
                value={backgroundStatus}
                onChange={(e) => setBackgroundStatus(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                {BACKGROUND_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Suitability Determination</label>
              <select
                value={suitabilityDetermination}
                onChange={(e) => setSuitabilityDetermination(e.target.value)}
                className="field-input"
                disabled={pending}
              >
                {SUITABILITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="section-label">Investigation Tracking</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Assigned Investigator</label>
              <input
                type="text"
                placeholder="Optional"
                value={assignedInvestigator}
                onChange={(e) => setAssignedInvestigator(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Investigation Start</label>
              <input
                type="date"
                value={investigationStartDate}
                onChange={(e) => setInvestigationStartDate(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Investigation Completion</label>
              <input
                type="date"
                value={investigationCompletionDate}
                onChange={(e) => setInvestigationCompletionDate(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Key Findings</label>
            <textarea
              placeholder="Optional"
              value={keyFindings}
              onChange={(e) => setKeyFindings(e.target.value)}
              className="field-input"
              rows={3}
              disabled={pending}
            />
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
            <button className="btn btn-primary" disabled={pending} onClick={create}>
              Create Profile
            </button>
            <button className="btn" disabled={pending} onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </ResponsiveOverlay>

      {adjustingPhoto && (
        <PhotoAdjuster file={adjustingPhoto} onCancel={cancelPhotoAdjust} onConfirm={confirmPhotoAdjust} />
      )}

      <NoObjectionFanout open={showFanout} onClose={() => setShowFanout(false)} people={people} />
    </div>
  );
}
