import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (!role) redirect("/login");
  if (role === "COMPLIANCE") redirect("/compliance/floor");
  if (role === "LICENSING") redirect("/licensing/profiles");
  redirect("/applicant");
}
