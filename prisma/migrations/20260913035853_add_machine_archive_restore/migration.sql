-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "priorBankId" TEXT,
ADD COLUMN     "priorSeatIndex" INTEGER,
ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "restoredBy" TEXT;
