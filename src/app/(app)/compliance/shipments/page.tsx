import { getShipmentList } from "@/lib/data/shipments";
import { ShipmentListView } from "@/components/views/shipment-list-view";

export default async function ShipmentsPage() {
  const shipments = await getShipmentList();
  return (
    <ShipmentListView
      shipments={shipments.map((s) => ({
        id: s.id,
        carrier: s.carrier,
        received: s.received.toISOString().slice(0, 10),
        status: s.status,
        documents: s.documents.map((d) => ({ id: d.id, name: d.name, date: d.date.toISOString().slice(0, 10) })),
        extracted: s.extracted.map((f) => ({ id: f.id, key: f.key, value: f.value })),
        notify: s.notify.map((n) => ({ id: n.id, email: n.email, sent: n.sent })),
      }))}
    />
  );
}
