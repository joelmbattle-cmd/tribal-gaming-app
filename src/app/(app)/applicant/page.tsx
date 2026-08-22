import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPerson } from "@/lib/data/people";
import { ApplicantPortalView } from "@/components/views/applicant-portal-view";

export default async function ApplicantPage() {
  const session = await auth();
  const personId = session?.user?.personId;
  if (!personId) redirect("/login");

  const person = await getPerson(personId);
  if (!person) redirect("/login");

  return (
    <ApplicantPortalView
      firstName={person.name.split(" ")[0]}
      personId={person.id}
      role={person.role}
      status={person.status}
      documents={person.documents.map((d) => ({
        id: d.id,
        name: d.name,
        date: d.date ? d.date.toISOString().slice(0, 10) : null,
        submitted: d.submitted,
      }))}
      history={person.history.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), event: h.event }))}
    />
  );
}
