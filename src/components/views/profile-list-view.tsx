"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveOverlay } from "@/components/overlay";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import { preparePhoto } from "@/lib/image-client";
import { createPersonAction, uploadPersonPhotoAction, addPersonDocumentAction, deletePersonDocumentAction, archivePersonAction } from "@/lib/actions/people";

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
  documents: { id: string; name: string; date: string | null }[];
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

export function ProfileListView({ people }: { people: ProfileViewItem[] }) {
  const variant = useShellVariant();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Holds the id being confirmed. Cleared whenever the drawer opens or closes
  // so a record can never appear pre-armed when it is reopened.
  const [confirmingArchive, setConfirmingArchive] = useState<string | null>(null);
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
  const fileInput = useRef<HTMLInputElement>(null);
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

    startTransition(async () => {
      try {
        // Downscale before sending: a camera photo exceeds the server action
        // body limit and would be rejected before reaching the upload code.
        const prepared = await preparePhoto(file);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const { storage } = await addPersonDocumentAction(selected, formData);
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
      await deletePersonDocumentAction(documentId);
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

  return (
    <div>
      <input ref={fileInput} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
      <input ref={photoInput} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />

      <div className="view-head">
        <div>
          <div className="view-title">Person Profiles</div>
          <div className="view-sub">Click a profile to review documents and background investigation status.</div>
        </div>
        {variant === "desktop" && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ New Profile</button>
        )}
      </div>

      <div className="profiles">
        {people.map((p) => (
          <button key={p.id} className="profile-row" onClick={() => openRecord(p.id)}>
            <div className="avatar">{p.name.split(" ").map((w) => w[0]).join("")}</div>
            <div><div className="p-name">{p.name}</div><div className="p-id">{p.id}</div></div>
            <div className="p-id">{p.role}</div>
            <div><span className={`chip ${STATUS_CHIP[p.status] ?? "chip-neutral"}`}>{STATUS_LABEL[p.status] ?? p.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={closeRecord}>
        {person && (
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

              <div className="section-label" style={{ marginTop: 16 }}>Identification</div>
              <div className="field-grid">
                <div><div className="field-label">Profile ID</div><div className="field-value">{person.id}</div></div>
                <div><div className="field-label">Category</div><div className="field-value" style={{ fontFamily: "var(--font-plex-sans)", fontSize: 12.5 }}>{person.role}</div></div>
                <div><div className="field-label">Date of Birth</div><div className="field-value">{person.dateOfBirth || "—"}</div></div>
                <div><div className="field-label">Contact Info</div><div className="field-value">{person.contactInfo || "—"}</div></div>
              </div>

              <div className="section-label">License</div>
              <div className="field-grid">
                <div><div className="field-label">License Type</div><div className="field-value">{person.licenseType || "—"}</div></div>
                <div><div className="field-label">License Number</div><div className="field-value">{person.licenseNumber || "—"}</div></div>
                <div><div className="field-label">Issue Date</div><div className="field-value">{person.licenseIssueDate || "—"}</div></div>
                <div><div className="field-label">Expiration Date</div><div className="field-value">{person.licenseExpirationDate || "—"}</div></div>
              </div>

              <div className="section-label">Application &amp; Status</div>
              <div className="field-grid">
                <div><div className="field-label">Application Date</div><div className="field-value">{person.applicationDate || "—"}</div></div>
                <div><div className="field-label">Application Status</div><div className="field-value">{person.applicationStatus || "—"}</div></div>
                <div><div className="field-label">Background Status</div><div className="field-value">{person.backgroundStatus || "—"}</div></div>
                <div><div className="field-label">Suitability Determination</div><div className="field-value">{person.suitabilityDetermination || "—"}</div></div>
              </div>

              <div className="section-label">Investigation Tracking</div>
              <div className="field-grid">
                <div><div className="field-label">Assigned Investigator</div><div className="field-value">{person.assignedInvestigator || "—"}</div></div>
                <div><div className="field-label">Investigation Start</div><div className="field-value">{person.investigationStartDate || "—"}</div></div>
                <div><div className="field-label">Investigation Completion</div><div className="field-value">{person.investigationCompletionDate || "—"}</div></div>
              </div>
              <div className="field-label" style={{ marginTop: 12 }}>Key Findings</div>
              <div className="field-value">{person.keyFindings || "—"}</div>

              <div className="section-label">Attached Documents ({person.documents.length})</div>
              {person.documents.map((d) => (
                <div className="doc-row" key={d.id}>
                  <span className="doc-icon">▤</span><span className="doc-name">{d.name}</span><span className="doc-meta">{d.date ?? "pending"}</span>
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
                {confirmingArchive === selected ? (
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
              </div>
            </div>
          </>
        )}
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
    </div>
  );
}
