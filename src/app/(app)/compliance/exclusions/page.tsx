import { getExclusionList } from "@/lib/data/exclusions";
import { ExclusionListView } from "@/components/views/exclusion-list-view";

export default async function ExclusionsPage() {
  const exclusions = await getExclusionList();
  return (
    <ExclusionListView
      exclusions={exclusions.map((c) => ({
        id: c.id,
        status: c.status,
        enrolled: c.enrolled.toISOString().slice(0, 10),
        term: c.term,
        photoUrl: c.photoUrl,
        documents: c.documents.map((d) => ({ id: d.id, name: d.name, date: d.date.toISOString().slice(0, 10) })),
        notes: c.notes.map((n) => ({ id: n.id, date: n.date.toISOString().slice(0, 10), event: n.event })),
      }))}
    />
  );
}
