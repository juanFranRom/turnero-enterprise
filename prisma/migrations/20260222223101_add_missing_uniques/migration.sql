/*
  Warnings:

  - You are about to drop the column `slot` on the `Appointment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,resourceId,dayOfWeek,startTime,endTime]` on the table `WeeklySchedule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WeeklySchedule_tenantId_resourceId_dayOfWeek_startTime_endT_key" ON "WeeklySchedule"("tenantId", "resourceId", "dayOfWeek", "startTime", "endTime");
