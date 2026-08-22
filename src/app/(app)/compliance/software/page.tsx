import { getMachineList } from "@/lib/data/machines";
import { SoftwareStatusView } from "@/components/views/software-status-view";
import { daysSince } from "@/lib/dates";

export default async function SoftwarePage() {
  const machines = await getMachineList();
  return (
    <SoftwareStatusView
      machines={machines.map((m) => ({
        serial: m.serial,
        manufacturer: m.manufacturer,
        model: m.model,
        bankName: m.bankName,
        softwareStatus: m.softwareStatus,
        daysInStatus: daysSince(m.statusSince),
      }))}
    />
  );
}
