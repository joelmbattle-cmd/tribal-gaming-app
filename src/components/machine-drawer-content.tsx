"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import {
  attachMachineDocumentAction,
  getMachineDrawerDataAction,
  setMachineComplianceStatusAction,
  updateMachineFieldsAction,
  type MachineDrawerData,
} from "@/lib/actions/machines";
import type { ComplianceStatus } from "@/generated/prisma/enums";

const STATUS_LABEL: Record<ComplianceStatus, string> = { VERIFIED: "Verified", FLAGGED: "Flagged", PENDING: "Pending" };
const STAMP_TEXT: Record<ComplianceStatus, string> = {
  VERIFIED: "Seal Verified",
  FLAGGED: "Exception Flagged",
  PENDING: "Awaiting Verify",
};
const LIFECYCLE_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  IN_TRANSIT: "In Transit",
  OUT_OF_SERVICE: "Out of Service",
  CONVERTED: "Converted",
  RETIRED: "Retired",
};
const HIGHLIGHT_LABEL: Record<string, string> = {
  NONE: "None",
  CONVERSION_PROJECT: "Conversion Project",
  REVOCATION: "Revocation",
};

export function MachineDrawerContent({
  serial,
  onClose,
  onChanged,
}: {
  serial: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  // Reset local state during render when `serial` changes (React's documented
  // pattern for adjusting state from props) instead of setState-in-effect.
  const [loadedSerial, setLoadedSerial] = useState(serial);
  const [data, setData] = useState<MachineDrawerData | null>(null);
  const [editing, setEditing] = useState(false);
  if (loadedSerial !== serial) {
    setLoadedSerial(serial);
    setData(null);
    setEditing(false);
  }
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const showToast = useToast();

  const load = () => {
    getMachineDrawerDataAction(serial).then(setData);
  };

  useEffect(() => {
    let cancelled = false;
    getMachineDrawerDataAction(serial).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [serial]);

  if (!data) {
    return (
      <>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow">Machine Master Record</div>
            <div className="drawer-title">Loading…</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body" />
      </>
    );
  }

  const setStatus = (status: ComplianceStatus) => {
    startTransition(async () => {
      try {
        await setMachineComplianceStatusAction(serial, status);
        showToast(`Machine marked ${STATUS_LABEL[status]}`);
        load();
        onChanged?.();
      } catch {
        showToast("Could not update status");
      }
    });
  };

  const save = (form: FormData) => {
    startTransition(async () => {
      try {
        await updateMachineFieldsAction(serial, {
          manufacturer: String(form.get("mfr") || ""),
          model: String(form.get("model") || ""),
          theme: String(form.get("theme") || ""),
          parSheet: String(form.get("par") || ""),
          sealNumber: String(form.get("seal") || ""),
        });
        showToast("Machine record saved");
        setEditing(false);
        load();
        onChanged?.();
      } catch {
        showToast("Could not save changes");
      }
    });
  };

  const attach = () => {
    const file = fileInput.current?.files?.[0];
    const formData = new FormData();
    if (file) formData.set("file", file);
    startTransition(async () => {
      try {
        await attachMachineDocumentAction(serial, formData);
        showToast("Document attached");
        if (fileInput.current) fileInput.current.value = "";
        load();
        onChanged?.();
      } catch {
        showToast("Could not attach document");
      }
    });
  };

  const stampClass =
    data.complianceStatus === "VERIFIED" ? "stamp-verified" : data.complianceStatus === "FLAGGED" ? "stamp-flagged" : "stamp-pending";

  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="drawer-eyebrow">Machine Master Record</div>
          <div className="drawer-title">{data.model}</div>
          <div className="p-id" style={{ marginTop: 4 }}>{data.serial} · {data.bankName}</div>
        </div>
        <div className="drawer-head-actions">
          {!editing && <button className="btn btn-small" onClick={() => setEditing(true)}>Edit</button>}
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="drawer-body">
        <div className="stamp-wrap">
          <div className={`stamp ${stampClass}`}>{STAMP_TEXT[data.complianceStatus]}</div>
        </div>

        <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Compliance Status</div>
        <div className="status-toggle">
          {(["VERIFIED", "FLAGGED", "PENDING"] as ComplianceStatus[]).map((s) => (
            <button
              key={s}
              disabled={pending}
              className={`status-btn status-btn-${s.toLowerCase()}${data.complianceStatus === s ? " active" : ""}`}
              onClick={() => setStatus(s)}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {editing ? (
          <form action={save}>
            <div className="field-grid">
              <div><div className="field-label">Serial Number</div><div className="field-value">{data.serial}</div></div>
              <div><div className="field-label">Asset Number</div><div className="field-value">—</div></div>
              <div><div className="field-label">Manufacturer</div><input className="field-input" name="mfr" defaultValue={data.manufacturer} /></div>
              <div><div className="field-label">Model</div><input className="field-input" name="model" defaultValue={data.model} /></div>
              <div><div className="field-label">Game Theme</div><input className="field-input" name="theme" defaultValue={data.theme} /></div>
              <div><div className="field-label">PAR Sheet</div><input className="field-input" name="par" defaultValue={data.parSheet} /></div>
              <div><div className="field-label">Seal Number</div><input className="field-input" name="seal" defaultValue={data.sealNumber} placeholder="e.g. SL-77291" /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={pending}>Save Changes</button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="field-grid">
            <div><div className="field-label">Serial Number</div><div className="field-value">{data.serial}</div></div>
            <div><div className="field-label">Manufacturer</div><div className="field-value">{data.manufacturer}</div></div>
            <div><div className="field-label">Model</div><div className="field-value">{data.model}</div></div>
            <div><div className="field-label">Game Theme</div><div className="field-value">{data.theme}</div></div>
            <div><div className="field-label">PAR Sheet</div><div className="field-value">{data.parSheet}</div></div>
            <div><div className="field-label">Seal Number</div><div className="field-value">{data.sealNumber || "— not sealed —"}</div></div>
            <div><div className="field-label">Lifecycle Status</div><div className="field-value">{LIFECYCLE_LABEL[data.lifecycleStatus]}</div></div>
            <div><div className="field-label">Highlight / Flag</div><div className="field-value">{HIGHLIGHT_LABEL[data.highlightFlag]}</div></div>
          </div>
        )}

        <div className="section-label">
          Attached Documents ({data.documents.length})
          <label className="btn btn-small" style={{ cursor: "pointer" }}>
            + Attach
            <input ref={fileInput} type="file" style={{ display: "none" }} onChange={attach} />
          </label>
        </div>
        {data.documents.map((d) => (
          <div className="doc-row" key={d.id}>
            <span className="doc-icon">▤</span>
            <span className="doc-name">{d.blobUrl ? <a href={d.blobUrl} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</span>
            <span className="doc-meta">{d.date}</span>
          </div>
        ))}

        <div className="section-label">Audit Trail</div>
        <div className="ledger">
          {data.history.map((h) => (
            <div className="ledger-item" key={h.id}>
              <div className="ledger-date">{h.date}</div>
              <div className="ledger-event">{h.event}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
