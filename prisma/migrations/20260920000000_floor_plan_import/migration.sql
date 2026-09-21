-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "cadRef" TEXT,
ADD COLUMN     "footprint" JSONB,
ADD COLUMN     "h" INTEGER,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "w" INTEGER;

-- CreateTable
CREATE TABLE "FloorPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL DEFAULT '',
    "units" TEXT,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "areaId" TEXT NOT NULL,
    "originX" INTEGER NOT NULL DEFAULT 40,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "outline" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FloorPlan_areaId_key" ON "FloorPlan"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_planId_cadRef_key" ON "Bank"("planId", "cadRef");

-- AddForeignKey
ALTER TABLE "FloorPlan" ADD CONSTRAINT "FloorPlan_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FloorPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

