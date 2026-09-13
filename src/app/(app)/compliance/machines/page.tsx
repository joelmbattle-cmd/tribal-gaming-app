import { getMachineList } from "@/lib/data/machines";
import { getBankOptions } from "@/lib/data/floor";
import { MachineListView } from "@/components/views/machine-list-view";

export default async function MachinesPage() {
  const [machines, banks] = await Promise.all([getMachineList(), getBankOptions()]);
  return <MachineListView machines={machines} banks={banks} />;
}
