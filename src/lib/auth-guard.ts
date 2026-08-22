import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Defense-in-depth role check for server actions. Middleware already gates
 * page navigation by role; every mutating server action re-checks here so a
 * crafted request can't bypass the route-level boundary (R4.2–R4.4).
 */
export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user || !roles.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session.user;
}
