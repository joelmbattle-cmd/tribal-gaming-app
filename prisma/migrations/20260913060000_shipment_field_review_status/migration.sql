-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PROPOSED', 'ACCEPTED');

-- AlterTable
ALTER TABLE "ShipmentField" ADD COLUMN     "status" "ExtractionStatus" NOT NULL DEFAULT 'ACCEPTED',
ADD COLUMN     "confidence" DOUBLE PRECISION;
