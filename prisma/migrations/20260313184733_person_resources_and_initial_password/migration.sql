/*
  Warnings:

  - The values [STAFF] on the enum `ResourceKind` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[personId]` on the table `Resource` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[personId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ResourceKind_new" AS ENUM ('PERSON', 'ROOM', 'EQUIPMENT');
ALTER TABLE "public"."Resource" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Resource" ALTER COLUMN "kind" TYPE "ResourceKind_new" USING ("kind"::text::"ResourceKind_new");
ALTER TYPE "ResourceKind" RENAME TO "ResourceKind_old";
ALTER TYPE "ResourceKind_new" RENAME TO "ResourceKind";
DROP TYPE "public"."ResourceKind_old";
ALTER TABLE "Resource" ALTER COLUMN "kind" SET DEFAULT 'PERSON';
COMMIT;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "description" TEXT,
ADD COLUMN     "personId" TEXT,
ALTER COLUMN "kind" SET DEFAULT 'PERSON';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "personId" TEXT;

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_tenantId_isActive_idx" ON "Person"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Person_tenantId_lastName_firstName_idx" ON "Person"("tenantId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Person_tenantId_documentNumber_key" ON "Person"("tenantId", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Person_tenantId_email_key" ON "Person"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_personId_key" ON "Resource"("personId");

-- CreateIndex
CREATE INDEX "Resource_tenantId_kind_isActive_idx" ON "Resource"("tenantId", "kind", "isActive");

-- CreateIndex
CREATE INDEX "Resource_tenantId_personId_idx" ON "Resource"("tenantId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
