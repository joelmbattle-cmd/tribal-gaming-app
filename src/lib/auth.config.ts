import type { NextAuthConfig } from "next-auth";
import "@/lib/auth-types";

/**
 * Edge-safe NextAuth config (no Prisma/bcrypt imports) used by the
 * middleware/proxy to read the session cookie. The full config with the
 * Credentials provider (which needs the database) lives in auth.ts and is
 * only ever imported by Node.js-runtime code (route handlers, server
 * actions, server components).
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.personId = user.personId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role!;
      session.user.personId = token.personId;
      return session;
    },
  },
};
