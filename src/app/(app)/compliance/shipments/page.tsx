import { getShipmentList } from "@/lib/data/shipments";
import { getMachineOptions } from "@/lib/data/machines";
import { ShipmentListView } from "@/components/views/shipment-list-view";

export default async function ShipmentsPage() {
  const [shipments, machines] = await Promise.all([getShipmentList(), getMachineOptions()]);
  return (
    <ShipmentListView
      machines={machines}
      shipments={shipments.map((s) => ({
        id: s.id,
        type: s.type,
        vendor: s.vendor,
        carrier: s.carrier,
        shippingDate: s.shippingDate.toISOString().slice(0, 10),
        estimatedArrivalDate: s.estimatedArrivalDate ? s.estimatedArrivalDate.toISOString().slice(0, 10) : null,
        status: s.status,
        documents: s.documents.map((d) => ({ id: d.id, name: d.name, date: d.date.toISOString().slice(0, 10) })),
        acceptedFields: s.extracted.filter((f) => f.status === "ACCEPTED").map((f) => ({ id: f.id, key: f.key, value: f.value })),
        proposedFields: s.extracted
          .filter((f) => f.status === "PROPOSED")
          .map((f) => ({ id: f.id, key: f.key, value: f.value, confidence: f.confidence })),
        notify: s.notify.map((n) => ({ id: n.id, email: n.email, sent: n.sent })),
        machines: s.machines.map((sm) => ({
          id: sm.machine.id,
          serial: sm.machine.serial,
          manufacturer: sm.machine.manufacturer,
          model: sm.machine.model,
          archived: sm.machine.archived,
        })),
      }))}
    />
  );
}
