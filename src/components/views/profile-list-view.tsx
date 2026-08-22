"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveOverlay } from "@/components/overlay";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import { createPersonAction, uploadPersonPhotoAction, addPersonDocumentAction, deletePersonDocumentAction, archivePersonAction } from "@/lib/actions/people";

export type ProfileViewItem = {
  id: string;
  name: string;
  role: string;
  status: string;
  photoUrl?: string | null;
  documents: { id: string; name: string; date: string | null }[];
  history: { id: string; date: string; event: string }[];
};

const STATUS_CHIP: Record<string, string> = { cleared: "chip-cleared", flagged: "chip-flagged", investigation: "chip-investigation" };
const STATUS_LABEL: Record<string, string> = { cleared: "Cleared", flagged: "Flagged", investigation: "Under Investigation" };
const STAMP_CLASS: Record<string, string> = { cleared: "stamp-verified", flagged: "stamp-flagged", investigation: "stamp-pending" };
const STAMP_TEXT: Record<string, string> = { cleared: "License Issued", flagged: "Review Required", investigation: "In Progress" };

export function ProfileListView({ people }: { people: ProfileViewItem[] }) {
  const variant = useShellVariant();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [personStatus, setPersonStatus] = useState("investigation");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useToast();
  const person = people.find((p) => p.id === selected);

  const create = () => {
    if (!name.trim() || !role.trim()) {
      showToast("Name and role are required");
      return;
    }
    startTransition(async () => {
      try {
        await createPersonAction(name, role, personStatus);
        setName("");
        setRole("");
        setPersonStatus("investigation");
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
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          await uploadPersonPhotoAction(selected, base64);
          showToast("Photo updated");
          router.refresh();
        };
        reader.readAsDataURL(file);
      } catch {
        showToast("Failed to upload photo");
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;

    startTransition(async () => {
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          await addPersonDocumentAction(selected, file.name, base64);
          showToast(`Document "${file.name}" attached`);
          router.refresh();
        };
        reader.readAsDataURL(file);
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

  const archive = () => {
    startTransition(async () => {
      await archivePersonAction(selected!);
      setSelected(null);
      showToast("Profile archived");
      router.refresh();
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
              <button
                className="btn"
                disabled={pending}
                onClick={() => photoInput.current?.click()}
                style={{ marginTop: 12 }}
              >
                {person.photoUrl ? "Update Photo" : "+ Add Photo"}
              </button>
              <div className="field-grid" style={{ marginTop: 16 }}>
                <div><div className="field-label">Profile ID</div><div className="field-value">{person.id}</div></div>
                <div><div className="field-label">Category</div><div className="field-value" style={{ fontFamily: "var(--font-plex-sans)", fontSize: 12.5 }}>{person.role}</div></div>
              </div>
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
                <button className="btn" disabled={pending} onClick={archive}>
                  Archive Profile
                </button>
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
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Profile Information</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Name</label>
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Role</label>
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
