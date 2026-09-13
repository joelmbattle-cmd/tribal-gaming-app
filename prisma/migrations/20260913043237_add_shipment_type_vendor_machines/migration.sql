-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Inbound',
ADD COLUMN     "vendor" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ShipmentMachine" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentMachine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentMachine_shipmentId_machineId_key" ON "ShipmentMachine"("shipmentId", "machineId");

-- AddForeignKey
ALTER TABLE "ShipmentMachine" ADD CONSTRAINT "ShipmentMachine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentMachine" ADD CONSTRAINT "ShipmentMachine_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
