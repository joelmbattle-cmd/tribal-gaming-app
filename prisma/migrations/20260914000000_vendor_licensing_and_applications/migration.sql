-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "vendorCompanyId" TEXT;

-- CreateTable
CREATE TABLE "VendorCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contactInfo" TEXT,
    "address" TEXT,
    "licenseType" TEXT,
    "licenseNumber" TEXT,
    "licenseIssueDate" TIMESTAMP(3),
    "licenseExpirationDate" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" TEXT,
    "createdBy" TEXT,
    "lastModifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "progress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "contactInfo" TEXT,
    "licenseType" TEXT,
    "licenseNumber" TEXT,
    "licenseIssueDate" TIMESTAMP(3),
    "licenseExpirationDate" TIMESTAMP(3),
    "applicationDate" TIMESTAMP(3),
    "applicationStatus" TEXT,
    "backgroundStatus" TEXT,
    "suitabilityDetermination" TEXT,
    "assignedInvestigator" TEXT,
    "investigationStartDate" TIMESTAMP(3),
    "investigationCompletionDate" TIMESTAMP(3),
    "keyFindings" TEXT,
    "vendorCompanyId" TEXT,
    "personId" TEXT,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_personId_key" ON "Application"("personId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "VendorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "VendorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
