-- AlterTable
ALTER TABLE "Exclusion" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "restoredBy" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "restoredBy" TEXT;
