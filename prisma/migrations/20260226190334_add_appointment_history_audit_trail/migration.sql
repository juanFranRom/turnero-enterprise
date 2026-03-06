-- CreateEnum
CREATE TYPE "AppointmentHistoryAction" AS ENUM ('CREATED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "AppointmentHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "action" "AppointmentHistoryAction" NOT NULL,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "actorUserId" TEXT,
    "resourceId" TEXT NOT NULL,
    "serviceId" TEXT,
    "locationId" TEXT NOT NULL,
    "prevStartsAt" TIMESTAMP(3),
    "prevEndsAt" TIMESTAMP(3),
    "newStartsAt" TIMESTAMP(3),
    "newEndsAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_appointmentId_createdAt_idx" ON "AppointmentHistory"("tenantId", "appointmentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_action_createdAt_idx" ON "AppointmentHistory"("tenantId", "action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_actorUserId_createdAt_idx" ON "AppointmentHistory"("tenantId", "actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_createdAt_idx" ON "AppointmentHistory"("tenantId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
