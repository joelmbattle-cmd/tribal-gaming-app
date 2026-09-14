// Fixed, deterministic static forms filled from a licensee profile's own
// fields — no freeform AI prose, every line here is plain string
// interpolation, matching the same approach as shipment-templates.ts.

import type { DocumentSlot } from "@/generated/prisma/enums";

export type FormType = "SUITABILITY" | "NOTICE_OF_RESULTS" | "ISSUANCE" | "DENIAL";

export const FORM_TYPES: FormType[] = ["SUITABILITY", "NOTICE_OF_RESULTS", "ISSUANCE", "DENIAL"];

export const FORM_LABEL: Record<FormType, string> = {
  SUITABILITY: "Suitability Determination",
  NOTICE_OF_RESULTS: "Notice of Results",
  ISSUANCE: "Issuance of License",
  DENIAL: "Denial Letter",
};

/** The checklist slot each generated form is filed under once produced. */
export const FORM_SLOT: Record<FormType, DocumentSlot> = {
  SUITABILITY: "SUITABILITY_REPORT",
  NOTICE_OF_RESULTS: "NOTICE_OF_RESULTS",
  ISSUANCE: "LICENSE_ISSUANCE",
  DENIAL: "DENIAL_LETTER",
};

export type FormPersonData = {
  id: string;
  name: string;
  position: string | null;
  ssn: string | null;
  dateOfBirth: string | null; // yyyy-mm-dd
  licenseType: string | null;
  licenseNumber: string | null;
  licenseIssueDate: string | null;
  licenseExpirationDate: string | null;
  suitabilityDeterminationLabel: string; // e.g. "Suitable" / "Pending" / "Unsuitable"
  applicationStatusLabel: string; // e.g. "Approved" / "Denied"
  keyFindings: string | null;
};

const DASH = "—";

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @media print { @page { margin: 0.75in; } }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 680px; margin: 40px auto; padding: 0 24px; line-height: 1.55; }
  .letterhead { text-align: center; border-bottom: 3px double #1a1a1a; padding-bottom: 14px; margin-bottom: 28px; }
  .letterhead .agency { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #444; }
  .letterhead .title { font-size: 20px; font-weight: bold; margin-top: 6px; letter-spacing: 0.03em; text-transform: uppercase; }
  .meta { font-size: 13px; color: #444; margin-bottom: 24px; }
  .field-table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
  .field-table td { padding: 6px 8px; border: 1px solid #ccc; vertical-align: top; }
  .field-table td.label { width: 180px; font-weight: bold; background: #f4f4f0; }
  .body-text { font-size: 14px; margin: 20px 0; white-space: pre-wrap; }
  .signature-block { margin-top: 56px; font-size: 14px; }
  .signature-line { border-top: 1px solid #1a1a1a; width: 320px; margin-top: 48px; padding-top: 6px; }
  .disclaimer { margin-top: 40px; font-size: 10.5px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
  @media screen { body { background: #fafaf7; box-shadow: 0 0 0 1px #ddd; } }
</style>
</head>
<body>
  <div class="letterhead">
    <div class="agency">Tribal Gaming Compliance &amp; Licensing Platform</div>
    <div class="title">${escapeHtml(title)}</div>
  </div>
  ${bodyHtml}
  <div class="disclaimer">SALES DEMO — fabricated practice data. Not a real regulatory document. Generated ${todayLong()} from profile fields.</div>
</body>
</html>`;
}

function fieldRow(label: string, value: string | null): string {
  return `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value || DASH)}</td></tr>`;
}

function signatureBlock(): string {
  return `<div class="signature-block">
    <div class="signature-line">Licensing Director / Authorized Signatory</div>
  </div>`;
}

function buildSuitability(p: FormPersonData): string {
  const body = `
    <div class="meta">Date: ${todayLong()} · Profile ID: ${escapeHtml(p.id)}</div>
    <table class="field-table">
      ${fieldRow("Full Legal Name", p.name)}
      ${fieldRow("Social Security Number", p.ssn)}
    </table>
    <div class="body-text">This letter confirms the suitability determination on record for the above-named individual in connection with their gaming license application.

Suitability Determination: ${p.suitabilityDeterminationLabel}</div>
    ${signatureBlock()}
  `;
  return page("Suitability Determination", body);
}

function buildNoticeOfResults(p: FormPersonData): string {
  const body = `
    <div class="meta">Date: ${todayLong()} · Profile ID: ${escapeHtml(p.id)}</div>
    <table class="field-table">
      ${fieldRow("Full Legal Name", p.name)}
      ${fieldRow("Position", p.position)}
      ${fieldRow("Social Security Number", p.ssn)}
      ${fieldRow("Date of Birth", p.dateOfBirth)}
    </table>
    <div class="body-text">This notice communicates the results of the background investigation conducted for the above-named applicant.

Application Status: ${p.applicationStatusLabel}

Findings: ${p.keyFindings || DASH}</div>
    ${signatureBlock()}
  `;
  return page("Notice of Results", body);
}

function buildIssuance(p: FormPersonData): string {
  const body = `
    <div class="meta">Date: ${todayLong()} · Profile ID: ${escapeHtml(p.id)}</div>
    <table class="field-table">
      ${fieldRow("Full Legal Name", p.name)}
      ${fieldRow("Position", p.position)}
      ${fieldRow("Social Security Number", p.ssn)}
      ${fieldRow("Date of Birth", p.dateOfBirth)}
      ${fieldRow("License Type", p.licenseType)}
      ${fieldRow("License Number", p.licenseNumber)}
      ${fieldRow("Issue Date", p.licenseIssueDate)}
      ${fieldRow("Expiration Date", p.licenseExpirationDate)}
    </table>
    <div class="body-text">This certifies that a gaming license has been issued to the above-named individual under the terms and conditions of applicable tribal gaming regulations, effective as of the issue date shown above.</div>
    ${signatureBlock()}
  `;
  return page("Issuance of License", body);
}

function buildDenial(p: FormPersonData): string {
  const body = `
    <div class="meta">Date: ${todayLong()} · Profile ID: ${escapeHtml(p.id)}</div>
    <table class="field-table">
      ${fieldRow("Full Legal Name", p.name)}
      ${fieldRow("Position", p.position)}
      ${fieldRow("Social Security Number", p.ssn)}
      ${fieldRow("Date of Birth", p.dateOfBirth)}
    </table>
    <div class="body-text">This letter serves to notify the above-named applicant that their gaming license application has been denied.

Application Status: ${p.applicationStatusLabel}

Reason: ${p.keyFindings || DASH}

You may have the right to appeal this determination in accordance with applicable tribal gaming regulations.</div>
    ${signatureBlock()}
  `;
  return page("Denial Letter", body);
}

const BUILDERS: Record<FormType, (p: FormPersonData) => string> = {
  SUITABILITY: buildSuitability,
  NOTICE_OF_RESULTS: buildNoticeOfResults,
  ISSUANCE: buildIssuance,
  DENIAL: buildDenial,
};

export function buildForm(formType: FormType, person: FormPersonData): string {
  return BUILDERS[formType](person);
}
