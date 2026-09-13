import { getMachineList } from "@/lib/data/machines";
import { getAreas, getBankOptions } from "@/lib/data/floor";
import { MachineListView } from "@/components/views/machine-list-view";

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const [machines, banks, areas] = await Promise.all([getMachineList(showArchived), getBankOptions(), getAreas()]);
  return <MachineListView machines={machines} banks={banks} areas={areas} showArchived={showArchived} />;
}
