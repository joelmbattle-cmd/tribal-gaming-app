-- AlterEnum: new document checklist slot for the static forms pass
ALTER TYPE "DocumentSlot" ADD VALUE 'DENIAL_LETTER';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN "ssn" TEXT;
