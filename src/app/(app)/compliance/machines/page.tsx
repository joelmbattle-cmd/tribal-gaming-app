import { getMachineList } from "@/lib/data/machines";
import { getAreas, getBankOptions } from "@/lib/data/floor";
import { MachineListView } from "@/components/views/machine-list-view";

export default async function MachinesPage() {
  const [machines, banks, areas] = await Promise.all([getMachineList(), getBankOptions(), getAreas()]);
  return <MachineListView machines={machines} banks={banks} areas={areas} />;
}
