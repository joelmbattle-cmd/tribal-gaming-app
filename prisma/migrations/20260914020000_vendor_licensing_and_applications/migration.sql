-- Idempotent by design: a Neon preview DB tied to this PR already applied
-- an earlier revision of this same logical migration (under a different,
-- now-retired file name) that added Person.vendorCompanyId and created
-- VendorCompany/Application in an older shape — Application.applicationStatus
-- as plain TEXT, no position/jobDescription columns. Renaming/editing that
-- migration file made Prisma treat the edited version as brand new, so a
-- plain re-run collided with objects that already existed there (P3018 /
-- Postgres 42701 "column already exists"). Every statement below is written
-- to succeed whether the underlying objects already exist (that preview DB)
-- or not (a fresh DB, or any other environment) — never assume dropping the
-- previously-created objects and never destroy any data.

-- AlterTable
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "vendorCompanyId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "VendorCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contactInfo" TEXT,
    "address" TEXT,
    "licenseType" TEXT,
    "licenseNumber" TEXT,
    "licenseIssueDate" TIMESTAMP(3),
    "licenseExpirationDate" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" TEXT,
    "createdBy" TEXT,
    "lastModifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable: base columns shared by every revision of this table. The
-- columns that changed between revisions (applicationStatus's type,
-- position, jobDescription) are reconciled separately below so a table
-- already created by the older revision gets brought up to date instead of
-- silently skipped by IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS "Application" (
    "id" TEXT NOT NULL,
    "progress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "contactInfo" TEXT,
    "licenseType" TEXT,
    "licenseNumber" TEXT,
    "licenseIssueDate" TIMESTAMP(3),
    "licenseExpirationDate" TIMESTAMP(3),
    "applicationDate" TIMESTAMP(3),
    "backgroundStatus" TEXT,
    "suitabilityDetermination" TEXT,
    "assignedInvestigator" TEXT,
    "investigationStartDate" TIMESTAMP(3),
    "investigationCompletionDate" TIMESTAMP(3),
    "keyFindings" TEXT,
    "vendorCompanyId" TEXT,
    "personId" TEXT,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- AlterTable: columns added when this migration was edited during the #16
-- merge — no-op if the table was created fresh above (already has them) or
-- if an older revision already picked them up.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "jobDescription" TEXT;

-- AlterTable: applicationStatus must end up typed as the
-- LicensingApplicationStatus enum (added by migration
-- 20260914005834_add_licensing_application_status, which always runs
-- before this one). Three cases: column doesn't exist yet (table just
-- created above) -> add it typed directly; column exists as TEXT (the
-- older revision of this migration) -> convert in place, using the same
-- value mapping as that Person conversion; column is already the enum
-- (already reconciled) -> no-op.
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'Application' AND column_name = 'applicationStatus';

  IF col_type IS NULL THEN
    ALTER TABLE "Application" ADD COLUMN "applicationStatus" "LicensingApplicationStatus";
  ELSIF col_type <> 'USER-DEFINED' THEN
    ALTER TABLE "Application" ALTER COLUMN "applicationStatus" TYPE "LicensingApplicationStatus" USING (
      CASE "applicationStatus"
        WHEN 'Received' THEN 'APPLICATION_TURNED_IN'
        WHEN 'Under Review' THEN 'READY_TO_REVIEW'
        WHEN 'Additional Info Needed' THEN 'APPLICATION_NOT_FINISHED'
        WHEN 'Accepted' THEN 'APPROVED'
        WHEN 'Rejected' THEN 'DENIED'
        WHEN 'Closed' THEN 'WITHDRAWN'
        ELSE NULL
      END
    )::"LicensingApplicationStatus";
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Application_personId_key" ON "Application"("personId");

-- AddForeignKey: Postgres has no "ADD CONSTRAINT IF NOT EXISTS", so guard
-- each with a duplicate_object catch instead.
DO $$ BEGIN
  ALTER TABLE "Person" ADD CONSTRAINT "Person_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "VendorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Application" ADD CONSTRAINT "Application_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "VendorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Application" ADD CONSTRAINT "Application_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
