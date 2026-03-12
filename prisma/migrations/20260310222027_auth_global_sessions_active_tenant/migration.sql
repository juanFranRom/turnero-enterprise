/*
  Warnings:

  - You are about to drop the column `tenantId` on the `Session` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_tenantId_fkey";

-- DropIndex
DROP INDEX "Session_tenantId_idx";

-- DropIndex
DROP INDEX "Session_tenantId_revokedAt_idx";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "tenantId",
ADD COLUMN     "activeTenantId" TEXT;

-- CreateIndex
CREATE INDEX "Session_activeTenantId_idx" ON "Session"("activeTenantId");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeTenantId_fkey" FOREIGN KEY ("activeTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
