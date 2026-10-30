/**
 * SSN display helpers. Full SSNs never go into list payloads / RSC client
 * props — only the last 4 digits. The full value is fetched on demand via
 * revealPersonSsnAction, which writes an audit entry to PersonHistory.
 */
export function ssnLast4(ssn: string | null | undefined): string | null {
  if (!ssn) return null;
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function maskSsn(last4: string | null | undefined): string {
  return last4 ? `•••-••-${last4}` : "—";
}
