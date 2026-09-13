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
        received: s.received.toISOString().slice(0, 10),
        status: s.status,
        documents: s.documents.map((d) => ({ id: d.id, name: d.name, date: d.date.toISOString().slice(0, 10) })),
        extracted: s.extracted.map((f) => ({ id: f.id, key: f.key, value: f.value })),
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
