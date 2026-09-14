import Link from "next/link";
import {
  EXPIRY_STATUS_CHIP,
  EXPIRY_STATUS_LABEL,
  daysUntilExpiry,
  licenseExpiryStatus,
  type ExpiryStatus,
} from "@/lib/license-expiry";

export type MonitorPersonItem = {
  id: string;
  name: string;
  role: string;
  licenseExpirationDate: string;
  vendorCompanyId: string | null;
  vendorCompanyName: string | null;
};

export type MonitorCompanyItem = {
  id: string;
  name: string;
  licenseExpirationDate: string;
};

function daysMessage(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function splitByStatus<T extends { licenseExpirationDate: string }>(items: T[]) {
  const expired: T[] = [];
  const expiring: T[] = [];
  for (const item of items) {
    const status: ExpiryStatus = licenseExpiryStatus(new Date(item.licenseExpirationDate));
    if (status === "expired") expired.push(item);
    else if (status === "expiring") expiring.push(item);
  }
  return { expired, expiring };
}

function StatusRow({ children, expirationDate, href }: { children: React.ReactNode; expirationDate: string; href: string }) {
  const status = licenseExpiryStatus(new Date(expirationDate));
  const days = daysUntilExpiry(new Date(expirationDate))!;
  return (
    <Link href={href} className="profile-row">
      {children}
      <div className="p-id">{daysMessage(days)}</div>
      <div><span className={`chip ${EXPIRY_STATUS_CHIP[status]}`}>{EXPIRY_STATUS_LABEL[status]}</span></div>
      <div className="chevron">›</div>
    </Link>
  );
}

function PersonRows({ items }: { items: MonitorPersonItem[] }) {
  if (items.length === 0) return <div className="field-label" style={{ padding: "8px 0 16px" }}>None.</div>;
  return (
    <div className="profiles" style={{ marginBottom: 24 }}>
      {items.map((p) => (
        <StatusRow key={p.id} expirationDate={p.licenseExpirationDate} href={p.vendorCompanyId ? `/licensing/vendors/${p.vendorCompanyId}` : "/licensing/profiles"}>
          <div className="avatar">{p.name.split(" ").map((w) => w[0]).join("")}</div>
          <div>
            <div className="p-name">{p.name}</div>
            <div className="p-id">{p.id} · {p.vendorCompanyName ? `${p.vendorCompanyName} principal` : p.role}</div>
          </div>
        </StatusRow>
      ))}
    </div>
  );
}

function CompanyRows({ items }: { items: MonitorCompanyItem[] }) {
  if (items.length === 0) return <div className="field-label" style={{ padding: "8px 0 16px" }}>None.</div>;
  return (
    <div className="profiles" style={{ marginBottom: 24 }}>
      {items.map((c) => (
        <StatusRow key={c.id} expirationDate={c.licenseExpirationDate} href={`/licensing/vendors/${c.id}`}>
          <div className="avatar">{c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
          <div>
            <div className="p-name">{c.name}</div>
            <div className="p-id">{c.id}</div>
          </div>
        </StatusRow>
      ))}
    </div>
  );
}

export function LicenseMonitorView({ people, companies }: { people: MonitorPersonItem[]; companies: MonitorCompanyItem[] }) {
  const peopleSplit = splitByStatus(people);
  const companiesSplit = splitByStatus(companies);
  const totalExpired = peopleSplit.expired.length + companiesSplit.expired.length;
  const totalExpiring = peopleSplit.expiring.length + companiesSplit.expiring.length;

  return (
    <div>
      <div className="view-head">
        <div>
          <div className="view-title">License Monitor</div>
          <div className="view-sub">Licensee profiles and vendor companies with a license expired or due within 60 days.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="chip chip-flagged">{totalExpired} Expired</span>
          <span className="chip chip-investigation">{totalExpiring} Expiring Soon</span>
        </div>
      </div>

      <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>
        Licensee Profiles — Expired ({peopleSplit.expired.length})
      </div>
      <PersonRows items={peopleSplit.expired} />

      <div className="section-label">Licensee Profiles — Expiring Soon ({peopleSplit.expiring.length})</div>
      <PersonRows items={peopleSplit.expiring} />

      <div className="section-label">Vendor Companies — Expired ({companiesSplit.expired.length})</div>
      <CompanyRows items={companiesSplit.expired} />

      <div className="section-label">Vendor Companies — Expiring Soon ({companiesSplit.expiring.length})</div>
      <CompanyRows items={companiesSplit.expiring} />
    </div>
  );
}
