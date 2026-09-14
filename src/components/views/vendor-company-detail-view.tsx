"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { ProfileListView, STATUS_CHIP, STATUS_LABEL, type ProfileViewItem } from "@/components/views/profile-list-view";
import { archiveVendorCompanyAction, unarchiveVendorCompanyAction, updateVendorCompanyAction } from "@/lib/actions/vendor-companies";
import { acceptApplicationAction, rejectApplicationAction, markApplicationSubmittedAction } from "@/lib/actions/applications";
import { EXPIRY_STATUS_CHIP, EXPIRY_STATUS_LABEL, licenseExpiryStatus } from "@/lib/license-expiry";

const LICENSE_TYPE_OPTIONS = ["Vendor", "Manufacturer", "Distributor", "Other"];

export type VendorCompanyDetailItem = {
  id: string;
  name: string;
  status: string;
  contactInfo?: string | null;
  address?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
  licenseIssueDate?: string | null;
  licenseExpirationDate?: string | null;
  archived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  createdBy?: string | null;
  lastModifiedBy?: string | null;
};

export type PendingApplicationItem = {
  id: string;
  name: string;
  role: string;
  progress: string;
  invitedAt: string;
};

const PROGRESS_CHIP: Record<string, string> = {
  Invited: "chip-neutral",
  "In Progress": "chip-investigation",
  Submitted: "chip-investigation",
  Accepted: "chip-cleared",
  Rejected: "chip-flagged",
};

export function VendorCompanyDetailView({
  company,
  principals,
  showArchivedPrincipals,
  pendingApplications,
}: {
  company: VendorCompanyDetailItem;
  principals: ProfileViewItem[];
  showArchivedPrincipals: boolean;
  pendingApplications: PendingApplicationItem[];
}) {
  const router = useRouter();
  const showToast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(company.name);
  const [editStatus, setEditStatus] = useState(company.status);
  const [editContactInfo, setEditContactInfo] = useState(company.contactInfo ?? "");
  const [editAddress, setEditAddress] = useState(company.address ?? "");
  const [editLicenseType, setEditLicenseType] = useState(company.licenseType ?? LICENSE_TYPE_OPTIONS[0]);
  const [editLicenseNumber, setEditLicenseNumber] = useState(company.licenseNumber ?? "");
  const [editLicenseIssueDate, setEditLicenseIssueDate] = useState(company.licenseIssueDate ?? "");
  const [editLicenseExpirationDate, setEditLicenseExpirationDate] = useState(company.licenseExpirationDate ?? "");

  const startEdit = () => {
    setEditName(company.name);
    setEditStatus(company.status);
    setEditContactInfo(company.contactInfo ?? "");
    setEditAddress(company.address ?? "");
    setEditLicenseType(company.licenseType ?? LICENSE_TYPE_OPTIONS[0]);
    setEditLicenseNumber(company.licenseNumber ?? "");
    setEditLicenseIssueDate(company.licenseIssueDate ?? "");
    setEditLicenseExpirationDate(company.licenseExpirationDate ?? "");
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = () => {
    if (!editName.trim()) {
      showToast("Company name is required");
      return;
    }
    startTransition(async () => {
      try {
        await updateVendorCompanyAction(company.id, {
          name: editName.trim(),
          status: editStatus,
          contactInfo: editContactInfo.trim(),
          address: editAddress.trim(),
          licenseType: editLicenseType,
          licenseNumber: editLicenseNumber.trim(),
          licenseIssueDate: editLicenseIssueDate,
          licenseExpirationDate: editLicenseExpirationDate,
        });
        setEditing(false);
        showToast("Company updated");
        router.refresh();
      } catch {
        showToast("Failed to update company");
      }
    });
  };

  const archive = () => {
    startTransition(async () => {
      try {
        await archiveVendorCompanyAction(company.id);
        setConfirmingArchive(false);
        showToast("Vendor company archived");
        router.push("/licensing/vendors");
      } catch {
        showToast("Failed to archive vendor company");
      }
    });
  };

  const unarchive = () => {
    startTransition(async () => {
      try {
        await unarchiveVendorCompanyAction(company.id);
        showToast("Vendor company restored");
        router.refresh();
      } catch {
        showToast("Failed to restore vendor company");
      }
    });
  };

  const markSubmitted = (id: string) => {
    startTransition(async () => {
      await markApplicationSubmittedAction(id);
      showToast("Marked submitted");
      router.refresh();
    });
  };

  const accept = (id: string) => {
    startTransition(async () => {
      try {
        await acceptApplicationAction(id);
        showToast("Application accepted — principal profile created");
        router.refresh();
      } catch {
        showToast("Failed to accept application");
      }
    });
  };

  const reject = (id: string) => {
    startTransition(async () => {
      await rejectApplicationAction(id);
      showToast("Application rejected");
      router.refresh();
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/licensing/vendors" className="btn btn-small">← All Vendor Companies</Link>
      </div>

      <div className="view-head">
        <div>
          <div className="view-title">{company.name}</div>
          <div className="view-sub">{company.id} · Vendor Licensing</div>
        </div>
        <div>
          <span className={`chip ${STATUS_CHIP[company.status] ?? "chip-neutral"}`}>
            {STATUS_LABEL[company.status] ?? company.status}
          </span>
        </div>
      </div>

      <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Company Details</div>
      {editing ? (
        <>
          <div className="field-grid">
            <div>
              <label className="field-label">Company Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="field-input" disabled={pending}>
                <option value="cleared">Cleared</option>
                <option value="flagged">Flagged</option>
                <option value="investigation">Under Investigation</option>
              </select>
            </div>
            <div>
              <label className="field-label">Contact Info</label>
              <input type="text" value={editContactInfo} onChange={(e) => setEditContactInfo(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Address</label>
              <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">License Type</label>
              <select value={editLicenseType} onChange={(e) => setEditLicenseType(e.target.value)} className="field-input" disabled={pending}>
                {LICENSE_TYPE_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
            </div>
            <div>
              <label className="field-label">License Number</label>
              <input type="text" value={editLicenseNumber} onChange={(e) => setEditLicenseNumber(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Issue Date</label>
              <input type="date" value={editLicenseIssueDate} onChange={(e) => setEditLicenseIssueDate(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Expiration Date</label>
              <input type="date" value={editLicenseExpirationDate} onChange={(e) => setEditLicenseExpirationDate(e.target.value)} className="field-input" disabled={pending} />
              <div className="field-label" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
                Leave blank to default to 2 years from the issue date.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button className="btn btn-primary" disabled={pending} onClick={saveEdit}>Save Changes</button>
            <button className="btn" disabled={pending} onClick={cancelEdit}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="field-grid">
            <div><div className="field-label">Contact Info</div><div className="field-value">{company.contactInfo || "—"}</div></div>
            <div><div className="field-label">Address</div><div className="field-value">{company.address || "—"}</div></div>
            <div><div className="field-label">License Type</div><div className="field-value">{company.licenseType || "—"}</div></div>
            <div><div className="field-label">License Number</div><div className="field-value">{company.licenseNumber || "—"}</div></div>
            <div><div className="field-label">Issue Date</div><div className="field-value">{company.licenseIssueDate || "—"}</div></div>
            <div>
              <div className="field-label">Expiration Date</div>
              <div className="field-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {company.licenseExpirationDate || "—"}
                {company.licenseExpirationDate && (
                  <span className={`chip ${EXPIRY_STATUS_CHIP[licenseExpiryStatus(new Date(company.licenseExpirationDate))]}`}>
                    {EXPIRY_STATUS_LABEL[licenseExpiryStatus(new Date(company.licenseExpirationDate))]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {!company.archived && (
              <button className="btn" disabled={pending} onClick={startEdit}>Edit Details</button>
            )}
            {company.archived ? (
              <button className="btn btn-primary" disabled={pending} onClick={unarchive}>Restore Company</button>
            ) : confirmingArchive ? (
              <>
                <button className="btn btn-danger" disabled={pending} onClick={archive}>Confirm Archive</button>
                <button className="btn" disabled={pending} onClick={() => setConfirmingArchive(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn" disabled={pending} onClick={() => setConfirmingArchive(true)}>Archive Company</button>
            )}
          </div>
        </>
      )}

      <div className="section-label">Pending Applications — Need Apps ({pendingApplications.length})</div>
      {pendingApplications.length === 0 ? (
        <div className="field-label" style={{ padding: "8px 0 16px" }}>No pending applications for this company.</div>
      ) : (
        <div className="profiles" style={{ marginBottom: 24 }}>
          {pendingApplications.map((a) => (
            <div key={a.id} className="profile-row" style={{ cursor: "default" }}>
              <div className="avatar">{a.name.split(" ").map((w) => w[0]).join("")}</div>
              <div><div className="p-name">{a.name}</div><div className="p-id">{a.role}</div></div>
              <div className="p-id">Invited {a.invitedAt}</div>
              <div><span className={`chip ${PROGRESS_CHIP[a.progress] ?? "chip-neutral"}`}>{a.progress}</span></div>
              <div style={{ display: "flex", gap: 6 }}>
                {a.progress === "Invited" && (
                  <button className="btn btn-small" disabled={pending} onClick={() => markSubmitted(a.id)}>Mark Submitted</button>
                )}
                {(a.progress === "Submitted" || a.progress === "In Progress") && (
                  <button className="btn btn-small btn-primary" disabled={pending} onClick={() => accept(a.id)}>Accept</button>
                )}
                <button className="btn btn-small btn-danger" disabled={pending} onClick={() => reject(a.id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProfileListView
        people={principals}
        showArchived={showArchivedPrincipals}
        title={`Principals — Have Profiles (${principals.length})`}
        subtitle="Principals licensed under this company. Click a profile to review documents and background investigation status."
        vendorCompanyId={company.id}
      />
    </div>
  );
}
