"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveOverlay } from "@/components/overlay";
import { MachineDrawerContent } from "@/components/machine-drawer-content";

export type SoftwareStatusItem = {
  serial: string;
  manufacturer: string;
  model: string;
  bankName: string;
  softwareStatus: string;
  daysInStatus: number;
};

function chipClass(status: string) {
  if (status === "Compliant") return "chip-cleared";
  if (status === "Needs Update") return "chip-investigation";
  return "chip-flagged";
}

export function SoftwareStatusView({ machines }: { machines: SoftwareStatusItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();

  const revoked = machines.filter((m) => m.softwareStatus === "Conditionally Revoked" || m.softwareStatus === "Revoked").length;
  const needsUpdate = machines.filter((m) => m.softwareStatus === "Needs Update").length;
  const compliant = machines.length - revoked - needsUpdate;

  return (
    <div>
      <div className="view-title">AI Software Status Monitoring</div>
      <div className="view-sub">Visibility into software status across all EGDs, with time-in-status tracking.</div>

      <div className="alert-banner">
        <div className="alert-stat"><span className="num" style={{ color: "var(--alert)" }}>{revoked}</span><span className="lbl">Revoked / Conditional</span></div>
        <div className="alert-stat"><span className="num" style={{ color: "var(--pending)" }}>{needsUpdate}</span><span className="lbl">Needs Update</span></div>
        <div className="alert-stat"><span className="num" style={{ color: "var(--verify)" }}>{compliant}</span><span className="lbl">Compliant</span></div>
      </div>

      <div className="profiles">
        {machines.map((m) => (
          <button key={m.serial} className="profile-row" onClick={() => setSelected(m.serial)}>
            <div className="avatar mono">{m.manufacturer[0]}</div>
            <div><div className="p-name">{m.model}</div><div className="p-id">{m.serial} · {m.bankName}</div></div>
            <div className="p-id">{m.daysInStatus} days in status</div>
            <div><span className={`chip ${chipClass(m.softwareStatus)}`}>{m.softwareStatus}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ResponsiveOverlay open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <MachineDrawerContent serial={selected} onClose={() => setSelected(null)} onChanged={() => router.refresh()} />
        )}
      </ResponsiveOverlay>
    </div>
  );
}
