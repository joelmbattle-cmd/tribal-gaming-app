-- AlterTable
ALTER TABLE "ShipmentField" ADD COLUMN     "confident" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "matchKey" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'accepted';
