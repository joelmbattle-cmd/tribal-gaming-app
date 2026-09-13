// Client-safe: shared between the server-side extract pass and the review
// UI, so it must not import anything that pulls in the database.
export const EXTRACT_FIELD_LABELS: Record<string, string> = {
  carrier: "Carrier",
  vendor: "Vendor / Shipper",
  shippingDate: "Shipping Date",
  estimatedArrivalDate: "Estimated Arrival Date",
  ibolTracking: "IBOL / Tracking Number",
  serials: "Machine Serials Detected",
};
