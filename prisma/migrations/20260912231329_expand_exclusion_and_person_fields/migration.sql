-- updatedAt is added with a DEFAULT now() rather than the bare NOT NULL
-- Prisma generated, so it backfills existing rows instead of failing on
-- this deployment's 3 Exclusion and 4 Person rows. The default is dropped
-- immediately after, matching how @updatedAt normally behaves: Prisma sets
-- the value on every write, going forward, without a standing default.
-- AlterTable
ALTER TABLE "Exclusion" ADD COLUMN     "aliases" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "exclusionType" TEXT,
ADD COLUMN     "expirationDate" TIMESTAMP(3),
ADD COLUMN     "governmentId" TEXT,
ADD COLUMN     "lastModifiedBy" TEXT,
ADD COLUMN     "personName" TEXT,
ADD COLUMN     "restrictions" TEXT,
ADD COLUMN     "sourceInitiated" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Exclusion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "applicationDate" TIMESTAMP(3),
ADD COLUMN     "applicationStatus" TEXT,
ADD COLUMN     "assignedInvestigator" TEXT,
ADD COLUMN     "backgroundStatus" TEXT,
ADD COLUMN     "contactInfo" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "investigationCompletionDate" TIMESTAMP(3),
ADD COLUMN     "investigationStartDate" TIMESTAMP(3),
ADD COLUMN     "keyFindings" TEXT,
ADD COLUMN     "lastModifiedBy" TEXT,
ADD COLUMN     "licenseExpirationDate" TIMESTAMP(3),
ADD COLUMN     "licenseIssueDate" TIMESTAMP(3),
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "licenseType" TEXT,
ADD COLUMN     "suitabilityDetermination" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Person" ALTER COLUMN "updatedAt" DROP DEFAULT;
