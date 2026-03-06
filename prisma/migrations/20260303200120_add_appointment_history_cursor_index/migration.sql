-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_appointmentId_createdAt_id_idx" ON "AppointmentHistory"("tenantId", "appointmentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AppointmentHistory_tenantId_appointmentId_idx" ON "AppointmentHistory"("tenantId", "appointmentId");
