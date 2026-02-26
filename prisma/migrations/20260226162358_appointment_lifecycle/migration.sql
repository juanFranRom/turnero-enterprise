/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,cancelIdempotencyKey]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,rescheduleIdempotencyKey]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancelIdempotencyKey" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "rescheduleIdempotencyKey" TEXT,
ADD COLUMN     "rescheduleReason" TEXT,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3),
ADD COLUMN     "rescheduledFromId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_tenantId_cancelIdempotencyKey_key" ON "Appointment"("tenantId", "cancelIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_tenantId_rescheduleIdempotencyKey_key" ON "Appointment"("tenantId", "rescheduleIdempotencyKey");
