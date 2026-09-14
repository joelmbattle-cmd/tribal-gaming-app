-- AlterEnum: two new document checklist slots
ALTER TYPE "DocumentSlot" ADD VALUE 'LICENSING_ACTIONS';
ALTER TYPE "DocumentSlot" ADD VALUE 'SEPARATION_NOTICE';

-- AlterEnum: two new licensing statuses
ALTER TYPE "LicensingApplicationStatus" ADD VALUE 'LICENSED_WITH_CONDITIONS';
ALTER TYPE "LicensingApplicationStatus" ADD VALUE 'SEPARATED';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN "position" TEXT;
ALTER TABLE "Person" ADD COLUMN "jobDescription" TEXT;
