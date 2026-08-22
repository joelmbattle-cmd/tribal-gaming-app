import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: Role;
    personId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      personId?: string | null;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    personId?: string | null;
  }
}
