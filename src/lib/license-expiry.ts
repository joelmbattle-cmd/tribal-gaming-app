// Shared license-renewal timeline logic — used by both Person (licensees /
// vendor principals) and VendorCompany, since both carry the same
// licenseIssueDate / licenseExpirationDate shape.

/** Default renewal term applied when a license is issued without an explicit expiration. */
export const DEFAULT_LICENSE_TERM_YEARS = 2;

/** Licenses expiring within this many days are surfaced on the monitor as "expiring soon". */
export const EXPIRING_SOON_DAYS = 60;

/** License Monitor window: everything expired or due within this many days, bucketed below. */
export const MONITOR_WINDOW_DAYS = 90;

export type MonitorBucket = "expired" | "d0_30" | "d31_60" | "d61_90";
export const MONITOR_BUCKETS: MonitorBucket[] = ["expired", "d0_30", "d31_60", "d61_90"];
export const MONITOR_BUCKET_LABEL: Record<MonitorBucket, string> = {
  expired: "Expired",
  d0_30: "0–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
};

/** Bucket for a days-until-expiry value; null when outside the monitor window. */
export function monitorBucket(days: number | null): MonitorBucket | null {
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= 30) return "d0_30";
  if (days <= 60) return "d31_60";
  if (days <= MONITOR_WINDOW_DAYS) return "d61_90";
  return null;
}

export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * The expiration date to store when a license record is created/updated.
 * Respects an explicit expiration if the approver provided one (any length);
 * otherwise defaults to issueDate + DEFAULT_LICENSE_TERM_YEARS once an issue
 * date exists. Returns null when there's no issue date to default from.
 */
export function resolveLicenseExpiration(
  issueDate: Date | null,
  explicitExpiration: Date | null,
): Date | null {
  if (explicitExpiration) return explicitExpiration;
  if (issueDate) return addYears(issueDate, DEFAULT_LICENSE_TERM_YEARS);
  return null;
}

/** Earliest non-null expiration date among the given dates (null when none). */
export function soonestExpiry(dates: Array<Date | null | undefined>): Date | null {
  let soonest: Date | null = null;
  for (const d of dates) if (d && (!soonest || d < soonest)) soonest = d;
  return soonest;
}

/** Status keys shared by Person and VendorCompany. */
export const VENDOR_STATUSES = ["cleared", "flagged", "investigation"] as const;
/** New vendor companies start cleared; "investigation" is for individuals under background review. */
export const DEFAULT_VENDOR_COMPANY_STATUS = "cleared";

export type ExpiryStatus = "expired" | "expiring" | "ok" | "none";

export function licenseExpiryStatus(
  expirationDate: Date | null | undefined,
  today: Date = new Date(),
): ExpiryStatus {
  if (!expirationDate) return "none";
  const days = Math.floor((expirationDate.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= EXPIRING_SOON_DAYS) return "expiring";
  return "ok";
}

export const EXPIRY_STATUS_LABEL: Record<ExpiryStatus, string> = {
  expired: "Expired",
  expiring: "Expiring Soon",
  ok: "Active",
  none: "No Expiration on File",
};

export const EXPIRY_STATUS_CHIP: Record<ExpiryStatus, string> = {
  expired: "chip-flagged",
  expiring: "chip-investigation",
  ok: "chip-cleared",
  none: "chip-neutral",
};

/** Days until expiration (negative once expired). Null when there's no expiration date. */
export function daysUntilExpiry(expirationDate: Date | null | undefined, today: Date = new Date()): number | null {
  if (!expirationDate) return null;
  return Math.floor((expirationDate.getTime() - today.getTime()) / 86_400_000);
}
