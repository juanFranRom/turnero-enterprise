-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('LOCATION', 'RESOURCE', 'SERVICE', 'WEEKLY_SCHEDULE', 'RESOURCE_SERVICE', 'AVAILABILITY_OVERRIDE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "actorUserId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_id_idx" ON "AuditLog"("tenantId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_createdAt_id_idx" ON "AuditLog"("tenantId", "action", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_createdAt_id_idx" ON "AuditLog"("tenantId", "entity", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_entityId_createdAt_id_idx" ON "AuditLog"("tenantId", "entity", "entityId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_actorUserId_createdAt_id_idx" ON "AuditLog"("tenantId", "actorUserId", "createdAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
