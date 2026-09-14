"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponsiveOverlay } from "@/components/overlay";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import {
  createApplicationAction,
  markApplicationSubmittedAction,
  acceptApplicationAction,
  rejectApplicationAction,
} from "@/lib/actions/applications";

export type ApplicationViewItem = {
  id: string;
  progress: string;
  name: string;
  email: string;
  role: string;
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
  vendorCompanyId?: string | null;
  vendorCompanyName?: string | null;
  invitedBy?: string | null;
  invitedAt: string;
  submittedAt?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  personId?: string | null;
  personName?: string | null;
};

const PROGRESS_CHIP: Record<string, string> = {
  Invited: "chip-neutral",
  "In Progress": "chip-investigation",
  Submitted: "chip-investigation",
  Accepted: "chip-cleared",
  Rejected: "chip-flagged",
};

const LICENSE_TYPE_OPTIONS = ["Employee", "Vendor", "Key", "Other"];
const APPLICATION_STATUS_OPTIONS = ["Received", "Under Review", "Additional Info Needed", "Accepted", "Rejected", "Closed"];
const BACKGROUND_STATUS_OPTIONS = ["Not Started", "In Review", "Approved", "Denied", "Needs Info"];
const SUITABILITY_OPTIONS = ["Pending", "Suitable", "Unsuitable"];

export function ApplicationListView({
  applications,
  companies,
}: {
  applications: ApplicationViewItem[];
  companies: { id: string; name: string }[];
}) {
  const variant = useShellVariant();
  const router = useRouter();
  const showToast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [vendorCompanyId, setVendorCompanyId] = useState("");
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

  const application = applications.find((a) => a.id === selected);

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole("");
    setVendorCompanyId("");
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

  const send = () => {
    if (!name.trim() || !email.trim() || !role.trim()) {
      showToast("Name, email, and role are required");
      return;
    }
    startTransition(async () => {
      try {
        await createApplicationAction({
          name: name.trim(),
          email: email.trim(),
          role: role.trim(),
          vendorCompanyId: vendorCompanyId || undefined,
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
        showToast("Application sent");
        router.refresh();
      } catch {
        showToast("Failed to send application");
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
        showToast("Application accepted — licensee profile created");
        router.refresh();
      } catch {
        showToast("Failed to accept application");
      }
    });
  };

  const reject = (id: string) => {
    startTransition(async () => {
      await rejectApplicationAction(id);
      setSelected(null);
      showToast("Application rejected");
      router.refresh();
    });
  };

  return (
    <div>
      <div className="view-head">
        <div>
          <div className="view-title">Applications</div>
          <div className="view-sub">Send applications to prospective licensees and accept them into a profile once reviewed.</div>
        </div>
        {variant === "desktop" && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ Send Application</button>
        )}
      </div>

      <div className="profiles">
        {applications.length === 0 && (
          <div className="field-label" style={{ padding: 16 }}>No applications yet.</div>
        )}
        {applications.map((a) => (
          <button key={a.id} className="profile-row" onClick={() => setSelected(a.id)}>
            <div className="avatar">{a.name.split(" ").map((w) => w[0]).join("")}</div>
            <div><div className="p-name">{a.name}</div><div className="p-id">{a.email}</div></div>
            <div className="p-id">
              {a.vendorCompanyName ? `${a.vendorCompanyName} · ` : ""}Invited {a.invitedAt}
            </div>
            <div><span className={`chip ${PROGRESS_CHIP[a.progress] ?? "chip-neutral"}`}>{a.progress}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={() => setSelected(null)}>
        {application && (
          <>
            <div className="drawer-head">
              <div>
                <div className="drawer-eyebrow">Application</div>
                <div className="drawer-title">{application.name}</div>
                <div className="p-id" style={{ marginTop: 4 }}>{application.id} · {application.role}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="stamp-wrap">
                <span className={`chip ${PROGRESS_CHIP[application.progress] ?? "chip-neutral"}`}>{application.progress}</span>
              </div>

              <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Identification</div>
              <div className="field-grid">
                <div><div className="field-label">Email</div><div className="field-value">{application.email}</div></div>
                <div><div className="field-label">Vendor Company</div><div className="field-value">{application.vendorCompanyName || "—"}</div></div>
                <div><div className="field-label">Date of Birth</div><div className="field-value">{application.dateOfBirth || "—"}</div></div>
                <div><div className="field-label">Contact Info</div><div className="field-value">{application.contactInfo || "—"}</div></div>
              </div>

              <div className="section-label">License</div>
              <div className="field-grid">
                <div><div className="field-label">License Type</div><div className="field-value">{application.licenseType || "—"}</div></div>
                <div><div className="field-label">License Number</div><div className="field-value">{application.licenseNumber || "—"}</div></div>
                <div><div className="field-label">Issue Date</div><div className="field-value">{application.licenseIssueDate || "—"}</div></div>
                <div><div className="field-label">Expiration Date</div><div className="field-value">{application.licenseExpirationDate || "—"}</div></div>
              </div>

              <div className="section-label">Application &amp; Status</div>
              <div className="field-grid">
                <div><div className="field-label">Application Date</div><div className="field-value">{application.applicationDate || "—"}</div></div>
                <div><div className="field-label">Application Status</div><div className="field-value">{application.applicationStatus || "—"}</div></div>
                <div><div className="field-label">Background Status</div><div className="field-value">{application.backgroundStatus || "—"}</div></div>
                <div><div className="field-label">Suitability Determination</div><div className="field-value">{application.suitabilityDetermination || "—"}</div></div>
              </div>

              <div className="section-label">Investigation Tracking</div>
              <div className="field-grid">
                <div><div className="field-label">Assigned Investigator</div><div className="field-value">{application.assignedInvestigator || "—"}</div></div>
                <div><div className="field-label">Investigation Start</div><div className="field-value">{application.investigationStartDate || "—"}</div></div>
                <div><div className="field-label">Investigation Completion</div><div className="field-value">{application.investigationCompletionDate || "—"}</div></div>
              </div>
              <div className="field-label" style={{ marginTop: 12 }}>Key Findings</div>
              <div className="field-value">{application.keyFindings || "—"}</div>

              <div className="section-label">Progress</div>
              <div className="ledger">
                <div className="ledger-item">
                  <div className="ledger-date">{application.invitedAt}</div>
                  <div className="ledger-event">Invited{application.invitedBy ? ` by ${application.invitedBy}` : ""}</div>
                </div>
                {application.submittedAt && (
                  <div className="ledger-item">
                    <div className="ledger-date">{application.submittedAt}</div>
                    <div className="ledger-event">Marked submitted</div>
                  </div>
                )}
                {application.acceptedAt && (
                  <div className="ledger-item">
                    <div className="ledger-date">{application.acceptedAt}</div>
                    <div className="ledger-event">Accepted{application.acceptedBy ? ` by ${application.acceptedBy}` : ""}</div>
                  </div>
                )}
                {application.rejectedAt && (
                  <div className="ledger-item">
                    <div className="ledger-date">{application.rejectedAt}</div>
                    <div className="ledger-event">Rejected{application.rejectedBy ? ` by ${application.rejectedBy}` : ""}</div>
                  </div>
                )}
              </div>

              {application.personId ? (
                <div className="field-label" style={{ marginTop: 12 }}>
                  Profile created: <Link href="/licensing/profiles">{application.personName} ({application.personId})</Link>
                </div>
              ) : (
                <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
                  {application.progress === "Invited" && (
                    <button className="btn" disabled={pending} onClick={() => markSubmitted(application.id)}>Mark Submitted</button>
                  )}
                  {(application.progress === "Submitted" || application.progress === "In Progress") && (
                    <button className="btn btn-primary" disabled={pending} onClick={() => accept(application.id)}>
                      Accept → Create Profile
                    </button>
                  )}
                  {application.progress !== "Rejected" && (
                    <button className="btn btn-danger" disabled={pending} onClick={() => reject(application.id)}>Reject</button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </ResponsiveOverlay>

      <ResponsiveOverlay open={showCreateForm} onClose={() => setShowCreateForm(false)}>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow">New Application</div>
            <div className="drawer-title">Send Application</div>
          </div>
          <button className="drawer-close" onClick={() => setShowCreateForm(false)}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Identification</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Full Legal Name</label>
              <input type="text" placeholder="Required" value={name} onChange={(e) => setName(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input type="email" placeholder="Required" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Role / Category</label>
              <input type="text" placeholder="e.g., Applicant — Key Employee" value={role} onChange={(e) => setRole(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Vendor Company</label>
              <select value={vendorCompanyId} onChange={(e) => setVendorCompanyId(e.target.value)} className="field-input" disabled={pending}>
                <option value="">— None (individual licensee) —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Date of Birth</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Contact Info</label>
              <input type="text" placeholder="Phone / email / address" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} className="field-input" disabled={pending} />
            </div>
          </div>

          <div className="section-label">License</div>
          <div className="field-grid">
            <div>
              <label className="field-label">License Type</label>
              <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} className="field-input" disabled={pending}>
                {LICENSE_TYPE_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
            </div>
            <div>
              <label className="field-label">License Number</label>
              <input type="text" placeholder="Once issued" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="field-input" disabled={pending} />
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

          <div className="section-label">Application &amp; Status</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Application Date</label>
              <input type="date" value={applicationDate} onChange={(e) => setApplicationDate(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Application Status</label>
              <select value={applicationStatus} onChange={(e) => setApplicationStatus(e.target.value)} className="field-input" disabled={pending}>
                {APPLICATION_STATUS_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
            </div>
            <div>
              <label className="field-label">Background Status</label>
              <select value={backgroundStatus} onChange={(e) => setBackgroundStatus(e.target.value)} className="field-input" disabled={pending}>
                {BACKGROUND_STATUS_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
            </div>
            <div>
              <label className="field-label">Suitability Determination</label>
              <select value={suitabilityDetermination} onChange={(e) => setSuitabilityDetermination(e.target.value)} className="field-input" disabled={pending}>
                {SUITABILITY_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
            </div>
          </div>

          <div className="section-label">Investigation Tracking</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Assigned Investigator</label>
              <input type="text" placeholder="Optional" value={assignedInvestigator} onChange={(e) => setAssignedInvestigator(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Investigation Start</label>
              <input type="date" value={investigationStartDate} onChange={(e) => setInvestigationStartDate(e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Investigation Completion</label>
              <input type="date" value={investigationCompletionDate} onChange={(e) => setInvestigationCompletionDate(e.target.value)} className="field-input" disabled={pending} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Key Findings</label>
            <textarea placeholder="Optional" value={keyFindings} onChange={(e) => setKeyFindings(e.target.value)} className="field-input" rows={3} disabled={pending} />
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
            <button className="btn btn-primary" disabled={pending} onClick={send}>Send Application</button>
            <button className="btn" disabled={pending} onClick={() => setShowCreateForm(false)}>Cancel</button>
          </div>
        </div>
      </ResponsiveOverlay>
    </div>
  );
}
