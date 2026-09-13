// Fixed templates for the shipment dual preview (V1 §3). Plain string
// interpolation only — no freeform AI prose rewrite. Pure functions of the
// shipment's current fields so both previews regenerate for free whenever a
// caller re-renders with fresh data (no separate "regenerate" action needed).

export type PreviewShipment = {
  id: string;
  type: string;
  vendor: string;
  carrier: string;
  shippingDate: string;
  estimatedArrivalDate: string | null;
  status: string;
  machines: { serial: string; manufacturer: string; model: string }[];
  extracted: { key: string; value: string; status: string }[];
  notify: { email: string }[];
};

function acceptedFields(s: PreviewShipment) {
  return s.extracted.filter((f) => f.status === "accepted");
}

export function buildEmailPreview(s: PreviewShipment): { subject: string; body: string } {
  const tracking = acceptedFields(s).find((f) => f.key.startsWith("IBOL"))?.value ?? "—";
  const machineLines = s.machines.length
    ? s.machines.map((m) => `  - ${m.serial} — ${m.manufacturer} ${m.model}`).join("\n")
    : "  (none linked yet)";
  const fieldLines = acceptedFields(s).length
    ? acceptedFields(s).map((f) => `  - ${f.key}: ${f.value}`).join("\n")
    : "  (none accepted yet)";
  const to = s.notify.length ? s.notify.map((n) => n.email).join(", ") : "(no recipients configured)";

  const subject = `[Shipment Notification] ${s.type} Shipment — ${s.vendor || "Unknown Vendor"} via ${s.carrier}`;
  const body = `To: ${to}
Subject: ${subject}

This notice confirms a ${s.type.toLowerCase()} gaming equipment shipment requiring regulatory notification.

Vendor / Shipper: ${s.vendor || "—"}
Carrier: ${s.carrier}
Shipping Date: ${s.shippingDate}
Estimated Arrival: ${s.estimatedArrivalDate || "—"}
Tracking / IBOL #: ${tracking}

Machines (${s.machines.length}):
${machineLines}

Extracted Document Fields:
${fieldLines}

Please retain this notice for compliance records.
— Tribal Gaming Compliance System (automated notification)`;

  return { subject, body };
}

export function buildPermitPreview(s: PreviewShipment): string {
  const machineLines = s.machines.length
    ? s.machines.map((m) => `  - Serial ${m.serial} — ${m.manufacturer} ${m.model}`).join("\n")
    : "  (none linked yet)";
  const fieldLines = acceptedFields(s).length
    ? acceptedFields(s).map((f) => `  - ${f.key}: ${f.value}`).join("\n")
    : "  (none accepted yet)";

  return `GAMING EQUIPMENT SHIPPING PERMIT (DRAFT)

Shipment ID: ${s.id}
Type: ${s.type}
Status: ${s.status}

Vendor / Shipper: ${s.vendor || "—"}
Carrier: ${s.carrier}
Shipping Date: ${s.shippingDate}
Estimated Arrival Date: ${s.estimatedArrivalDate || "—"}

Machines Covered:
${machineLines}

Supporting Document Fields:
${fieldLines}

Authorized for regulatory filing pending compliance signature.`;
}
