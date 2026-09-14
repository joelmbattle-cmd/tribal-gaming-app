"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ResponsiveOverlay } from "@/components/overlay";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import { createVendorCompanyAction } from "@/lib/actions/vendor-companies";
import { STATUS_CHIP, STATUS_LABEL } from "@/components/views/profile-list-view";

export type VendorCompanyViewItem = {
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
  principalCount: number;
  pendingApplicationCount: number;
};

const LICENSE_TYPE_OPTIONS = ["Vendor", "Manufacturer", "Distributor", "Other"];

export function VendorCompanyListView({
  companies,
  showArchived,
}: {
  companies: VendorCompanyViewItem[];
  showArchived: boolean;
}) {
  const variant = useShellVariant();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const showToast = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("investigation");
  const [contactInfo, setContactInfo] = useState("");
  const [address, setAddress] = useState("");
  const [licenseType, setLicenseType] = useState(LICENSE_TYPE_OPTIONS[0]);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseIssueDate, setLicenseIssueDate] = useState("");
  const [licenseExpirationDate, setLicenseExpirationDate] = useState("");
  const [pending, startTransition] = useTransition();

  const resetForm = () => {
    setName("");
    setStatus("investigation");
    setContactInfo("");
    setAddress("");
    setLicenseType(LICENSE_TYPE_OPTIONS[0]);
    setLicenseNumber("");
    setLicenseIssueDate("");
    setLicenseExpirationDate("");
  };

  const create = () => {
    if (!name.trim()) {
      showToast("Company name is required");
      return;
    }
    startTransition(async () => {
      try {
        await createVendorCompanyAction({
          name: name.trim(),
          status,
          contactInfo: contactInfo.trim(),
          address: address.trim(),
          licenseType,
          licenseNumber: licenseNumber.trim(),
          licenseIssueDate,
          licenseExpirationDate,
        });
        resetForm();
        setShowCreateForm(false);
        showToast("Vendor company created");
        router.refresh();
      } catch {
        showToast("Failed to create vendor company");
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
      <div className="view-head">
        <div>
          <div className="view-title">{showArchived ? "Archived Vendor Companies" : "Vendor Companies"}</div>
          <div className="view-sub">Open a company to review its principals and pending applications.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={toggleShowArchived}>
            {showArchived ? "Show Active" : "Show Archived"}
          </button>
          {variant === "desktop" && !showArchived && (
            <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ New Company</button>
          )}
        </div>
      </div>

      <div className="profiles">
        {companies.length === 0 && (
          <div className="field-label" style={{ padding: 16 }}>
            {showArchived ? "No archived vendor companies." : "No active vendor companies."}
          </div>
        )}
        {companies.map((c) => (
          <button key={c.id} className="profile-row" onClick={() => router.push(`/licensing/vendors/${c.id}`)}>
            <div className="avatar">{c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
            <div><div className="p-name">{c.name}</div><div className="p-id">{c.id}</div></div>
            <div className="p-id">
              {showArchived
                ? `Archived ${c.archivedAt ?? ""} by ${c.archivedBy || "—"}`
                : `${c.principalCount} principal${c.principalCount === 1 ? "" : "s"} · ${c.pendingApplicationCount} pending app${c.pendingApplicationCount === 1 ? "" : "s"}`}
            </div>
            <div><span className={`chip ${STATUS_CHIP[c.status] ?? "chip-neutral"}`}>{STATUS_LABEL[c.status] ?? c.status}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={showCreateForm} onClose={() => setShowCreateForm(false)}>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow">New Company</div>
            <div className="drawer-title">Create Vendor Company</div>
          </div>
          <button className="drawer-close" onClick={() => setShowCreateForm(false)}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Identification</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Company Name</label>
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
              <label className="field-label">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input" disabled={pending}>
                <option value="cleared">Cleared</option>
                <option value="flagged">Flagged</option>
                <option value="investigation">Under Investigation</option>
              </select>
            </div>
            <div>
              <label className="field-label">Contact Info</label>
              <input
                type="text"
                placeholder="Phone / email"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Address</label>
              <input
                type="text"
                placeholder="Optional"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>

          <div className="section-label">License</div>
          <div className="field-grid">
            <div>
              <label className="field-label">License Type</label>
              <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} className="field-input" disabled={pending}>
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
              <input type="date" value={licenseIssueDate} onChange={(e) => setLicenseIssueDate(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Expiration Date</label>
              <input type="date" value={licenseExpirationDate} onChange={(e) => setLicenseExpirationDate(e.target.value)} className="field-input" disabled={pending} />
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
            <button className="btn btn-primary" disabled={pending} onClick={create}>
              Create Company
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
