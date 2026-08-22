import { getMachineList } from "@/lib/data/machines";
import { MachineListView } from "@/components/views/machine-list-view";

export default async function MachinesPage() {
  const machines = await getMachineList();
  return <MachineListView machines={machines} />;
}
