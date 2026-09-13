// Fixed, deterministic document templates filled from a shipment's own
// fields. No freeform AI prose — every line here is plain string
// interpolation, so a preview only ever changes when the underlying
// shipment/extracted fields change (accept a field, edit details, link a
// machine), never on its own.

export type ShipmentTemplateData = {
  id: string;
  type: string;
  vendor: string;
  carrier: string;
  shippingDate: string; // yyyy-mm-dd
  estimatedArrivalDate: string | null;
  status: string;
  ibolTracking: string | null;
  machines: { serial: string; manufacturer: string; model: string }[];
  notifyEmails: string[];
};

export function buildEmailPreview(s: ShipmentTemplateData): { subject: string; body: string } {
  const subject = `${s.type} Shipment ${s.id} — ${s.status}`;
  const machineLines = s.machines.length
    ? s.machines.map((m) => `  • ${m.serial} — ${m.manufacturer} ${m.model}`).join("\n")
    : "  (no machines linked)";

  const body = [
    `To: ${s.notifyEmails.length ? s.notifyEmails.join(", ") : "(no recipients configured)"}`,
    `Subject: ${subject}`,
    "",
    `This is an automated compliance notification for shipment ${s.id}.`,
    "",
    `Type: ${s.type}`,
    `Vendor / Shipper: ${s.vendor || "—"}`,
    `Carrier: ${s.carrier || "—"}`,
    `Shipping Date: ${s.shippingDate}`,
    `Estimated Arrival: ${s.estimatedArrivalDate || "—"}`,
    `IBOL / Tracking Number: ${s.ibolTracking || "—"}`,
    "",
    "Machines:",
    machineLines,
    "",
    "This notification was generated automatically from accepted shipment fields.",
    "No further action is required unless a discrepancy is found upon receipt.",
  ].join("\n");

  return { subject, body };
}

export function buildPermitPreview(s: ShipmentTemplateData): string {
  const deviceLines = s.machines.length
    ? s.machines.map((m, i) => `  ${i + 1}. Serial ${m.serial} — ${m.manufacturer} ${m.model}`)
    : ["  (no devices linked)"];

  return [
    "TRIBAL GAMING COMMISSION",
    "GAMING DEVICE SHIPPING PERMIT",
    "─".repeat(46),
    `Permit Reference: ${s.id}`,
    `Shipment Type: ${s.type}`,
    "",
    `Vendor / Shipper: ${s.vendor || "—"}`,
    `Carrier: ${s.carrier || "—"}`,
    `IBOL / Tracking Number: ${s.ibolTracking || "—"}`,
    "",
    `Shipping Date: ${s.shippingDate}`,
    `Estimated Arrival Date: ${s.estimatedArrivalDate || "—"}`,
    "",
    `Devices Authorized (${s.machines.length}):`,
    ...deviceLines,
    "",
    "This permit authorizes movement of the gaming devices listed above in",
    "accordance with tribal gaming compliance regulations. Devices must remain",
    "under chain-of-custody control until receipt is confirmed and compliance",
    "verification is complete.",
    "",
    `Status: ${s.status}`,
  ].join("\n");
}
