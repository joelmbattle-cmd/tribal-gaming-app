import { getPersonList } from "@/lib/data/people";
import { ProfileListView } from "@/components/views/profile-list-view";

export default async function ProfilesPage() {
  const people = await getPersonList();
  return (
    <ProfileListView
      people={people.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        status: p.status,
        photoUrl: p.photoUrl,
        documents: p.documents.map((d) => ({ id: d.id, name: d.name, date: d.date ? d.date.toISOString().slice(0, 10) : null })),
        history: p.history.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), event: h.event })),
      }))}
    />
  );
}
