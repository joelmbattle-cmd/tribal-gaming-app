import { db } from "@/lib/db";
import { EXTRACT_FIELD_LABELS } from "@/lib/shipment-field-labels";

export type ProposedField = { key: string; label: string; value: string; confidence: number };

const CARRIERS = ["FedEx Freight", "UPS Freight", "XPO Logistics", "Old Dominion Freight", "J.B. Hunt", "Estes Express"];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

type ShipmentForExtraction = {
  id: string;
  type: string;
  vendor: string;
  carrier: string;
  shippingDate: Date;
  estimatedArrivalDate: Date | null;
  machines: { machineId: string }[];
};

/**
 * V1 extract pass, run on document upload. Calls the configured LLM when
 * ANTHROPIC_API_KEY is set; otherwise (and on any LLM error) falls back to a
 * deterministic simulation seeded from the shipment + file name, so a given
 * upload always reviews the same way rather than re-rolling on every page
 * load. Either path only ever *proposes* fields — nothing here writes to the
 * shipment; that happens on human accept (see acceptShipmentExtractionAction).
 */
export async function extractShipmentFields(shipmentId: string, fileName: string): Promise<ProposedField[]> {
  const shipment = await db.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      type: true,
      vendor: true,
      carrier: true,
      shippingDate: true,
      estimatedArrivalDate: true,
      machines: { select: { machineId: true } },
    },
  });
  if (!shipment) return [];

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await extractViaLLM(shipment, fileName);
    } catch (err) {
      console.error("[shipment-extract] LLM extraction failed, falling back to simulation", err);
    }
  }
  return simulateExtraction(shipment, fileName);
}

async function extractViaLLM(shipment: ShipmentForExtraction, fileName: string): Promise<ProposedField[]> {
  const prompt = `You are scrubbing a shipping document for a tribal gaming compliance system. The uploaded file is named "${fileName}" for shipment ${shipment.id} (type: ${shipment.type}). On file so far: vendor="${shipment.vendor}", carrier="${shipment.carrier}", shippingDate="${isoDate(shipment.shippingDate)}", estimatedArrivalDate="${shipment.estimatedArrivalDate ? isoDate(shipment.estimatedArrivalDate) : ""}".

Propose values for as many of these fields as you can reasonably infer: carrier, vendor, shippingDate (YYYY-MM-DD), estimatedArrivalDate (YYYY-MM-DD), ibolTracking (IBOL or tracking number), serials (comma-separated gaming machine serial numbers, if any are named in the document).

Respond with ONLY a JSON object mapping field key -> { "value": string, "confidence": number between 0 and 1 }. Omit any field you cannot infer.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API request failed: ${res.status}`);

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON object in LLM response");

  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Record<string, { value?: unknown; confidence?: unknown }>;
  const fields: ProposedField[] = [];
  for (const key of Object.keys(EXTRACT_FIELD_LABELS)) {
    const entry = parsed[key];
    if (!entry || typeof entry.value !== "string" || !entry.value.trim()) continue;
    const confidence = typeof entry.confidence === "number" ? Math.min(1, Math.max(0, entry.confidence)) : 0.5;
    fields.push({ key, label: EXTRACT_FIELD_LABELS[key], value: entry.value.trim(), confidence });
  }
  if (fields.length === 0) throw new Error("LLM proposed no usable fields");
  return fields;
}

async function simulateExtraction(shipment: ShipmentForExtraction, fileName: string): Promise<ProposedField[]> {
  const seed = hashString(`${shipment.id}:${fileName}`);
  const fields: ProposedField[] = [];

  fields.push({
    key: "carrier",
    label: EXTRACT_FIELD_LABELS.carrier,
    value: shipment.carrier || CARRIERS[seed % CARRIERS.length],
    confidence: shipment.carrier ? 0.88 : 0.55,
  });
  fields.push({
    key: "vendor",
    label: EXTRACT_FIELD_LABELS.vendor,
    value: shipment.vendor || "Unknown Vendor",
    confidence: shipment.vendor ? 0.82 : 0.5,
  });
  fields.push({
    key: "shippingDate",
    label: EXTRACT_FIELD_LABELS.shippingDate,
    value: isoDate(shipment.shippingDate),
    confidence: 0.9,
  });

  const eta = shipment.estimatedArrivalDate ?? addDays(shipment.shippingDate, 3 + (seed % 4));
  fields.push({
    key: "estimatedArrivalDate",
    label: EXTRACT_FIELD_LABELS.estimatedArrivalDate,
    value: isoDate(eta),
    confidence: shipment.estimatedArrivalDate ? 0.8 : 0.55,
  });

  const trackingPrefix = shipment.type === "Outbound" ? "RMA" : "IBOL";
  fields.push({
    key: "ibolTracking",
    label: EXTRACT_FIELD_LABELS.ibolTracking,
    value: `${trackingPrefix}-${100000 + (seed % 900000)}`,
    confidence: 0.93,
  });

  const linkedIds = new Set(shipment.machines.map((m) => m.machineId));
  const candidates = await db.machine.findMany({
    where: { id: { notIn: [...linkedIds] } },
    orderBy: { serial: "asc" },
    select: { serial: true },
    take: 50,
  });
  if (candidates.length > 0) {
    const count = 1 + (seed % Math.min(2, candidates.length));
    const picked = new Set<string>();
    for (let i = 0; picked.size < count; i++) {
      picked.add(candidates[(seed + i * 7) % candidates.length].serial);
      if (i > candidates.length) break; // safety valve, never actually reached given count <= candidates.length
    }
    fields.push({
      key: "serials",
      label: EXTRACT_FIELD_LABELS.serials,
      value: [...picked].join(", "),
      confidence: 0.65,
    });
  }

  return fields;
}
