// Simulated AI document extraction for shipments (V1 — no model key wired
// up). Deterministic per (shipmentId, documentName) so re-reading the same
// upload always proposes the same fields, the way a real model call would be
// stable on the same input document.
//
// `matchKey` says which Shipment field (or "serial" for a related machine)
// an accepted value should be written back into; `confident` gates whether
// accept applies that write automatically. A field with no shipment-side
// target (e.g. a tracking number) carries `matchKey: null`.

export type MatchKey = "vendor" | "carrier" | "shippingDate" | "estimatedArrivalDate" | "serial";

export type ProposedField = {
  key: string;
  value: string;
  matchKey: MatchKey | null;
  confident: boolean;
};

function seededInt(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  return mod > 0 ? h % mod : 0;
}

export function simulateShipmentExtraction(input: {
  documentName: string;
  shipmentId: string;
  vendor: string;
  carrier: string;
  shippingDate: string; // yyyy-mm-dd
  estimatedArrivalDate: string | null;
  // Machine serials not already linked to this shipment — candidates the
  // simulated pass can "find" in the document and propose as related machines.
  candidateSerials: string[];
}): ProposedField[] {
  const seed = `${input.shipmentId}:${input.documentName}`;
  const fields: ProposedField[] = [];

  if (input.vendor) {
    fields.push({ key: "Vendor / Shipper", value: input.vendor, matchKey: "vendor", confident: true });
  }
  if (input.carrier) {
    fields.push({ key: "Carrier", value: input.carrier, matchKey: "carrier", confident: true });
  }
  fields.push({ key: "Shipping Date", value: input.shippingDate, matchKey: "shippingDate", confident: true });
  if (input.estimatedArrivalDate) {
    fields.push({
      key: "Estimated Arrival Date",
      value: input.estimatedArrivalDate,
      matchKey: "estimatedArrivalDate",
      confident: true,
    });
  }

  const tracking = `1Z${(100000000 + seededInt(`${seed}:tracking`, 899999999)).toString()}`;
  fields.push({ key: "IBOL / Tracking #", value: tracking, matchKey: null, confident: true });

  // Deterministically "find" 0-2 known machines in the document text — an
  // exact serial match in the system is what makes these confident.
  const pool = input.candidateSerials;
  if (pool.length > 0) {
    const count = Math.min(pool.length, 1 + seededInt(`${seed}:count`, 2));
    const start = seededInt(`${seed}:start`, pool.length);
    for (let i = 0; i < count; i++) {
      const serial = pool[(start + i) % pool.length];
      fields.push({ key: "Serial Number", value: serial, matchKey: "serial", confident: true });
    }
  }

  // One unmatched serial, to demonstrate the review gate: a value the
  // document appears to contain but that doesn't resolve to a known machine,
  // so it's recorded for the record but never auto-linked.
  const unmatched = `EGD-${10000 + seededInt(`${seed}:unmatched`, 89999)}`;
  fields.push({ key: "Serial Number (unmatched)", value: unmatched, matchKey: "serial", confident: false });

  return fields;
}
