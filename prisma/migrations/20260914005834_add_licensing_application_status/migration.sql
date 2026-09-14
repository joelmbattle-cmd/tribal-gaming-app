-- CreateEnum
CREATE TYPE "LicensingApplicationStatus" AS ENUM ('APPLICATION_NOT_FINISHED', 'APPLICATION_TURNED_IN', 'READY_TO_REVIEW', 'APPROVED', 'TEMPORARY_LICENSE', 'DENIED', 'WITHDRAWN');

-- AlterTable: convert the old free-text applicationStatus values into the
-- new enum instead of dropping the column, so existing data survives.
ALTER TABLE "Person" ALTER COLUMN "applicationStatus" TYPE "LicensingApplicationStatus" USING (
  CASE "applicationStatus"
    WHEN 'Received' THEN 'APPLICATION_TURNED_IN'
    WHEN 'Under Review' THEN 'READY_TO_REVIEW'
    WHEN 'Additional Info Needed' THEN 'APPLICATION_NOT_FINISHED'
    WHEN 'Accepted' THEN 'APPROVED'
    WHEN 'Rejected' THEN 'DENIED'
    WHEN 'Closed' THEN 'WITHDRAWN'
    ELSE NULL
  END
)::"LicensingApplicationStatus";
