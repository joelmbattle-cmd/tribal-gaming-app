-- AlterTable
ALTER TABLE "Exclusion" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "ExclusionDocument" (
    "id" TEXT NOT NULL,
    "exclusionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blobUrl" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExclusionDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExclusionDocument" ADD CONSTRAINT "ExclusionDocument_exclusionId_fkey" FOREIGN KEY ("exclusionId") REFERENCES "Exclusion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
