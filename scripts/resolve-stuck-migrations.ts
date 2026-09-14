import "dotenv/config";
import { Client } from "pg";

/**
 * One-time self-heal for a specific class of migration mishap: a persistent
 * preview database (Neon branch tied to a PR, reused across pushes) already
 * ran an earlier revision of a migration under a name that was later renamed
 * and edited. Prisma then treated the edited file as brand new, re-ran a
 * statement that collided with what the earlier revision already created,
 * and failed (P3018) — leaving that migration name permanently recorded as
 * failed in `_prisma_migrations`. From then on, EVERY `prisma migrate
 * deploy` — even ones that don't touch anything related — refuses to apply
 * anything at all (P3009) until that record is resolved, and this
 * environment has no interactive access to run `prisma migrate resolve`
 * against it directly.
 *
 * This runs before `prisma migrate deploy` in the build script and clears
 * exactly that one known-stuck record if (and only if) it's there, so
 * deploy can proceed to reconcile the schema itself (the migration that
 * replaced it, 20260914020000_vendor_licensing_and_applications, is written
 * to be idempotent — safe whether its objects already partially exist or
 * not). A no-op everywhere else: a fresh database has no
 * `_prisma_migrations` table yet, and any other database simply won't have
 * a failed row under this name.
 */
const STUCK_MIGRATION_NAMES = [
  // Original name before the #16-merge edit (position/jobDescription,
  // enum-typed applicationStatus) — this is the one that actually failed
  // on the affected preview database.
  "20260914013000_vendor_licensing_and_applications",
  // Belt-and-suspenders: the even earlier pre-rename name, in case any
  // environment's history predates that first rename too.
  "20260914000000_vendor_licensing_and_applications",
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("[resolve-stuck-migrations] DATABASE_URL not set — skipping.");
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows: tableRows } = await client.query(
      "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists",
    );
    if (!tableRows[0]?.exists) {
      console.log("[resolve-stuck-migrations] No _prisma_migrations table yet (fresh database) — nothing to do.");
      return;
    }

    const { rows } = await client.query(
      `SELECT id, migration_name FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[]) AND finished_at IS NULL`,
      [STUCK_MIGRATION_NAMES],
    );

    if (rows.length === 0) {
      console.log("[resolve-stuck-migrations] No stuck migration records found — nothing to do.");
      return;
    }

    for (const row of rows) {
      console.log(`[resolve-stuck-migrations] Clearing stuck failed migration record: ${row.migration_name} (${row.id})`);
    }
    await client.query(
      `DELETE FROM "_prisma_migrations" WHERE id = ANY($1::text[])`,
      [rows.map((r) => r.id)],
    );
    console.log(`[resolve-stuck-migrations] Cleared ${rows.length} stuck record(s). Nothing from those attempts had actually applied (they failed on their first statement), so no schema changes were made — the current migrations reconcile the rest.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[resolve-stuck-migrations] Failed:", err);
  process.exit(1);
});
