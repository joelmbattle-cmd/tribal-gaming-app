import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations need a *direct* connection. Prisma takes a Postgres advisory lock
 * before applying migrations, and a connection pooler hands successive
 * statements to different backends, so the lock is never observed by the
 * session that needs it — `prisma migrate deploy` fails with P1002 after the
 * 10s acquire timeout.
 *
 * Neon exposes both endpoints under one hostname pair: the pooled host is the
 * direct host with `-pooler` inserted before the domain. Deriving the direct
 * URL here means the deployment needs only the single DATABASE_URL it already
 * has — no second environment variable to configure.
 *
 * Prisma 7 removed `directUrl` from the schema, and `@prisma/config`'s
 * Datasource only accepts `url`/`shadowDatabaseUrl`, so this is the remaining
 * place to express "migrations connect differently from the app".
 *
 * The app itself keeps using the pooled URL (see src/lib/db.ts) — that is the
 * right choice for serverless request handlers.
 */
function directConnectionUrl(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    // Scoped to the hostname so credentials containing "-pooler" are untouched.
    url.hostname = url.hostname.replace(/-pooler\./, ".");
    return url.toString();
  } catch {
    // Not a parseable URL (or an unusual DSN form) — leave it alone rather than
    // corrupting it; a bad URL should fail loudly at connect time, not here.
    return raw;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: directConnectionUrl(process.env.DATABASE_URL),
  },
});
